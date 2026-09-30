/* FBY page: inventory to send, box configuration, packing, dimensions, master cartons, warehouse,
   arrival and the live shipment summary + validation. Everything recalculates on every change. */
(function () {
  const PF = window.PF;
  const S = () => PF.state;
  const F = () => PF.state.fby;

  // ---- Derived data --------------------------------------------------------------

  // Current inventory = FBM available quantity, or a mock value when it was left empty
  PF.currentInventory = (u, i) => (u.qty !== '' && u.qty !== undefined ? PF.int(u.qty) : (PF.options.mockCurrentInventory || [])[i % 6] || 100);

  const selectedUnits = () => PF.units().filter((u) => F().selected[u.id]);
  const sendQty = (u) => PF.int(F().sendQty[u.id]);
  const totalUnits = () => selectedUnits().reduce((a, u) => a + sendQty(u), 0);

  // Capacity of each box, from "same quantity" (boxes × items) or the per-box table
  function boxCapacities() {
    const n = Math.max(0, PF.int(F().boxes));
    if (F().packingMethod === 'different') return Array.from({ length: n }, (_, i) => PF.int(F().perBox[i]));
    return Array.from({ length: n }, () => Math.max(0, PF.int(F().itemsPerBox)));
  }
  const boxTotal = () => boxCapacities().reduce((a, b) => a + b, 0);

  // Fills boxes in order. "one" = a box never mixes variations; "multiple" = boxes are filled continuously.
  function allocate() {
    const caps = boxCapacities();
    const boxes = caps.map((cap) => ({ cap, free: cap, items: [] }));
    let bi = 0;
    let leftover = 0;
    selectedUnits().forEach((u) => {
      let qty = sendQty(u);
      if (F().variationPacking === 'one' && bi < boxes.length && boxes[bi].items.length) bi += 1;
      while (qty > 0 && bi < boxes.length) {
        const box = boxes[bi];
        if (box.free <= 0) { bi += 1; continue; }
        const put = Math.min(qty, box.free);
        box.items.push({ unit: u, qty: put });
        box.free -= put;
        qty -= put;
        if (box.free === 0) bi += 1;
      }
      leftover += qty;
    });
    return { boxes, leftover, empty: boxes.filter((b) => !b.items.length).length };
  }

  const unitLabel = () => (F().dimUnit === 'inch' ? 'in' : 'cm');
  const weightLabel = () => F().weightUnit;

  // ---- Checks (shared by section validation and "Run Validation") ------------------------

  function checks() {
    const list = [];
    const sel = selectedUnits();
    const units = totalUnits();
    const alloc = allocate();
    list.push({ ok: sel.length > 0 && sel.every((u) => sendQty(u) > 0), text: sel.length ? 'Every selected variation has a quantity to send' : 'Select at least one variation to send' });
    const exceed = sel.filter((u, i) => sendQty(u) > PF.currentInventory(u, PF.units().indexOf(u)));
    list.push({ ok: !exceed.length, text: exceed.length ? `Quantity to send is more than current inventory for: ${exceed.map(PF.unitName).join(', ')}` : 'Quantities are within current inventory' });
    list.push({ ok: units > 0 && boxTotal() === units, text: boxTotal() === units ? `Boxes hold exactly ${units} units` : `Boxes hold ${boxTotal()} units but ${units} units are selected to send` });
    list.push({ ok: !alloc.leftover && !alloc.empty, text: alloc.leftover ? `${alloc.leftover} units do not fit with the chosen variation packing` : alloc.empty ? `${alloc.empty} box(es) would be empty` : 'Every box is used and every unit is packed' });
    const dimsOk = F().sameDims
      ? ['length', 'width', 'height', 'weight'].every((k) => PF.num(F()[k]) > 0)
      : boxCapacities().every((_, i) => { const d = F().boxDims[i] || {}; return ['length', 'width', 'height', 'weight'].every((k) => PF.num(d[k]) > 0); });
    list.push({ ok: dimsOk, text: dimsOk ? 'Box dimensions and weight are set' : 'Enter length, width, height and weight for the boxes' });
    if (F().useMaster === 'yes') {
      const cap = PF.int(F().masterCount) * PF.int(F().boxesPerMaster);
      const n = PF.int(F().boxes);
      list.push({ ok: cap >= n && n > 0, text: cap >= n ? `Master cartons hold all ${n} boxes` : `Master cartons hold ${cap} boxes but there are ${n}` });
    }
    list.push({ ok: Boolean(F().warehouse), text: F().warehouse ? 'Warehouse selected' : 'Select a warehouse' });
    const today = new Date().toISOString().slice(0, 10);
    const date = F().arrivalDate;
    list.push({ ok: Boolean(date) && date >= today, text: !date ? 'Set the expected arrival date' : date < today ? 'Expected arrival date is in the past' : 'Expected arrival date is set' });
    return list;
  }

  // ---- Rendering --------------------------------------------------------------------------

  function renderInventory() {
    const body = PF.$('[data-fby-rows]');
    if (!body) return;
    const units = PF.units();
    body.innerHTML = units.map((u, i) => {
      const on = Boolean(F().selected[u.id]);
      const name = PF.unitName(u);
      return `<tr class="${on ? 'is-selected' : ''}">
        <td><label class="pf-check pf-check--bare"><input type="checkbox" data-fby-select="${u.id}"${on ? ' checked' : ''} aria-label="Send ${PF.esc(name)}"><span class="pf-check__box" aria-hidden="true"><i data-lucide="check"></i></span></label></td>
        <td><div class="pf-cell-var"><img src="${PF.esc(PF.unitImage(u))}" alt="">${PF.esc(name)}</div></td>
        <td>${PF.esc(u.sku || S().basic.sku)}</td>
        <td>${PF.currentInventory(u, i)}</td>
        <td><input class="pf-input" type="number" min="1" step="1" inputmode="numeric" data-fby-qty="${u.id}" value="${on ? PF.esc(F().sendQty[u.id] || '') : '0'}"${on ? '' : ' disabled'} aria-label="Quantity to send for ${PF.esc(name)}"></td>
      </tr>`;
    }).join('');
    renderVariationSummary();
  }

  function renderVariationSummary() {
    const units = PF.units();
    const count = PF.$('[data-fby-selected-count]');
    if (count) count.textContent = `${selectedUnits().length} / ${units.length}`;
    const list = PF.$('[data-fby-var-summary]');
    if (list) {
      list.innerHTML = units.map((u) => {
        const on = F().selected[u.id];
        return `<li><img class="pf-var-thumb" src="${PF.esc(PF.unitImage(u))}" alt=""><div>${PF.esc(PF.unitName(u))}<small>${PF.esc(u.sku || S().basic.sku)}</small></div>
          <span class="pf-var-summary__qty${on ? '' : ' is-off'}">${on ? sendQty(u) : 'Not Selected'}</span></li>`;
      }).join('');
    }
  }

  function renderBoxes() {
    const different = F().packingMethod === 'different';
    PF.$$('[data-same-only]').forEach((el) => { el.hidden = different; });
    const perBox = PF.$('[data-per-box]');
    const n = Math.min(200, Math.max(0, PF.int(F().boxes)));
    if (perBox) {
      perBox.hidden = !different || !n;
      if (different && n) {
        const existing = perBox.querySelectorAll('[data-per-box-qty]').length;
        if (existing !== n) {
          perBox.innerHTML = `<p class="pf-label">Quantity in each box <span class="pf-req">*</span></p><div class="pf-table-wrap"><table class="pf-table pf-table--compact"><thead><tr><th>Box</th><th>Items in Box</th></tr></thead><tbody>
            ${Array.from({ length: n }, (_, i) => `<tr><td>Box ${i + 1}</td><td><input class="pf-input" type="number" min="1" step="1" inputmode="numeric" data-per-box-qty="${i}" value="${PF.esc(F().perBox[i] || '')}" aria-label="Items in box ${i + 1}"></td></tr>`).join('')}
            </tbody></table></div>`;
        }
      }
    }
    const total = PF.$('[data-fby-total]');
    if (total) total.value = boxTotal();
    const summary = PF.$('[data-box-summary]');
    if (summary) {
      summary.innerHTML = `<span>Boxes: <strong>${PF.int(F().boxes)}</strong></span><span>Items/Box: <strong>${different ? 'Varies' : PF.int(F().itemsPerBox)}</strong></span><span>Total: <strong>${boxTotal()}</strong></span>`;
    }
  }

  function renderPacking() {
    const body = PF.$('[data-box-contents]');
    if (!body) return;
    const { boxes } = allocate();
    const shown = boxes.filter((b) => b.items.length).slice(0, 3);
    const rows = [];
    shown.forEach((b) => b.items.forEach((it) => rows.push(`<tr><td>Box ${boxes.indexOf(b) + 1}</td><td>${PF.esc(PF.unitName(it.unit))}</td><td>${it.qty}</td></tr>`)));
    const more = boxes.filter((b) => b.items.length).length - shown.length;
    body.innerHTML = rows.join('') + (more > 0 ? `<tr><td colspan="3" class="pf-muted-cell">+ ${more} more box${more === 1 ? '' : 'es'}</td></tr>` : '')
      || '<tr><td colspan="3" class="pf-muted-cell">Select variations and configure boxes to see an example.</td></tr>';
  }

  function renderDims() {
    const same = F().sameDims;
    PF.$$('[data-same-dims]').forEach((el) => { el.hidden = !same; });
    PF.$$('.pf-section[data-section="y-dims"] .pf-addon').forEach((el) => { el.textContent = unitLabel(); });
    const wu = PF.$('[data-weight-unit-display]');
    if (wu) wu.value = weightLabel();
    const perBox = PF.$('[data-per-box-dims]');
    const n = Math.min(200, Math.max(0, PF.int(F().boxes)));
    if (perBox) {
      perBox.hidden = same || !n;
      if (!same && n && perBox.querySelectorAll('tbody tr').length !== n) {
        const cell = (i, k, label) => `<td><input class="pf-input" type="number" min="0" step="any" inputmode="decimal" data-box-dim="${i}" data-dim="${k}" value="${PF.esc((F().boxDims[i] || {})[k] || '')}" aria-label="Box ${i + 1} ${label}"></td>`;
        perBox.innerHTML = `<div class="pf-table-wrap"><table class="pf-table pf-table--compact"><thead><tr><th>Box</th><th>Length (${unitLabel()})</th><th>Width (${unitLabel()})</th><th>Height (${unitLabel()})</th><th>Weight (${weightLabel()})</th></tr></thead><tbody>
          ${Array.from({ length: n }, (_, i) => `<tr><td>Box ${i + 1}</td>${cell(i, 'length', 'length')}${cell(i, 'width', 'width')}${cell(i, 'height', 'height')}${cell(i, 'weight', 'weight')}</tr>`).join('')}
          </tbody></table></div>`;
      }
    }
    const preview = PF.$('[data-dims-preview]');
    if (preview) {
      preview.innerHTML = same
        ? `<span>All boxes will have the same dimensions and weight.</span>
           <span class="pf-dims-preview__line"><i data-lucide="box"></i> ${PF.num(F().length)} × ${PF.num(F().width)} × ${PF.num(F().height)} ${unitLabel()}</span>
           <span class="pf-dims-preview__line"><i data-lucide="weight"></i> ${PF.num(F().weight)} ${weightLabel()}</span>`
        : `<span>Each box has its own dimensions and weight.</span><span class="pf-dims-preview__line"><i data-lucide="boxes"></i> ${n} box${n === 1 ? '' : 'es'}</span>`;
    }
  }

  function renderMaster() {
    const use = F().useMaster === 'yes';
    PF.$$('[data-master-only]').forEach((el) => { el.hidden = !use; });
    const body = PF.$('[data-master-breakdown]');
    if (!body) return;
    const cartons = PF.int(F().masterCount);
    const per = PF.int(F().boxesPerMaster);
    const boxes = PF.int(F().boxes);
    const rows = [];
    let start = 1;
    for (let c = 1; c <= Math.min(cartons, 50); c += 1) {
      const end = Math.min(start + per - 1, boxes);
      rows.push(`<tr><td>Master Carton ${c}</td><td>${start <= boxes && per ? `Boxes ${start} – ${end}` : '<span class="pf-muted-cell">Empty</span>'}</td></tr>`);
      start += per;
    }
    if (boxes > cartons * per && cartons && per) rows.push(`<tr><td colspan="2" class="pf-error">${boxes - cartons * per} box(es) do not fit in the master cartons</td></tr>`);
    body.innerHTML = rows.join('') || '<tr><td class="pf-muted-cell">Enter the number of master cartons and boxes per carton.</td></tr>';
  }

  function renderWarehouse() {
    const box = PF.$('[data-warehouse-details]');
    if (!box) return;
    const w = (PF.options.warehouses || []).find((x) => x.id === F().warehouse);
    box.innerHTML = w
      ? `<i data-lucide="map-pin"></i><div><strong>${PF.esc(w.address)}</strong><br>Receiving Hours: ${PF.esc(w.receivingHours)}<br>Instructions: ${PF.esc(w.instructions)}</div>`
      : '<span>Select a warehouse to see its address and receiving hours.</span>';
  }

  function renderSummary() {
    const overall = PF.$('[data-ship-overall]');
    if (!overall) return;
    const w = (PF.options.warehouses || []).find((x) => x.id === F().warehouse);
    const { boxes } = allocate();
    const date = F().arrivalDate ? new Date(`${F().arrivalDate}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
    const kv = (k, v) => `<dt>${k}:</dt><dd>${PF.esc(v)}</dd>`;
    overall.innerHTML = kv('Product', S().basic.nameEn || '—') + kv('YPIN', S().product.ypin)
      + kv('Selected Variations', `${selectedUnits().length}`) + kv('Total Units', `${totalUnits()}`) + kv('Total Boxes', `${PF.int(F().boxes)}`)
      + kv('Warehouse', w ? w.name : '—') + kv('Expected Arrival', date + (F().arrivalWindow ? `, ${F().arrivalWindow}` : ''));

    const breakdown = PF.$('[data-ship-breakdown]');
    const rows = selectedUnits().map((u) => {
      const nBoxes = boxes.filter((b) => b.items.some((it) => it.unit === u)).length;
      return { name: PF.unitName(u), boxes: nBoxes, qty: sendQty(u) };
    });
    breakdown.innerHTML = rows.map((r) => `<tr><td>${PF.esc(r.name)}</td><td>${r.boxes}</td><td>${r.qty}</td></tr>`).join('')
      + (rows.length ? `<tr><td><strong>Total</strong></td><td><strong>${PF.int(F().boxes)}</strong></td><td><strong>${totalUnits()}</strong></td></tr>` : '<tr><td colspan="3" class="pf-muted-cell">No variations selected.</td></tr>');

    const packing = PF.$('[data-ship-packing]');
    packing.innerHTML = kv('Box Dimensions', F().sameDims ? `${PF.num(F().length)} × ${PF.num(F().width)} × ${PF.num(F().height)} ${unitLabel()}` : 'Varies per box')
      + kv('Box Weight', F().sameDims ? `${PF.num(F().weight)} ${weightLabel()}` : 'Varies per box')
      + kv('Packaging Type', F().packagingType || '—') + kv('Units Per Case', F().unitsPerCase || '—')
      + kv('Master Cartons', F().useMaster === 'yes' ? `${PF.int(F().masterCount)} (${PF.int(F().boxesPerMaster)} boxes each)` : 'Not used');
    renderValidation();
  }

  function renderValidation() {
    const status = PF.$('[data-validation-status]');
    if (!status) return;
    const v = F().validation;
    if (!v) {
      status.innerHTML = '<span class="pf-validation__icon is-idle"><i data-lucide="shield-question"></i></span><div><strong>Not validated yet</strong>Run validation to check your shipment.</div>';
    } else if (v.ok) {
      status.innerHTML = '<span class="pf-validation__icon is-ok"><i data-lucide="check"></i></span><div><strong>All information is valid!</strong>Your FBY shipment is ready to proceed.</div>';
    } else {
      const n = v.items.filter((i) => !i.ok).length;
      status.innerHTML = `<span class="pf-validation__icon is-bad"><i data-lucide="x"></i></span><div><strong>${n} issue${n === 1 ? '' : 's'} found</strong>Fix the items below and run validation again.</div>`;
    }
    const list = PF.$('[data-validation-list]');
    list.innerHTML = (v ? v.items : []).map((i) => `<li class="${i.ok ? 'is-ok' : 'is-bad'}"><i data-lucide="${i.ok ? 'circle-check' : 'circle-x'}"></i>${PF.esc(i.text)}</li>`).join('');
    if (v && !v.ok) { list.hidden = false; PF.$('[data-validation-toggle]').setAttribute('aria-expanded', 'true'); }
  }

  PF.runFbyValidation = () => {
    const items = checks();
    F().validation = { ok: items.every((i) => i.ok), items };
    renderValidation();
    PF.icons();
    return F().validation.ok;
  };

  function renderAll() {
    renderInventory();
    renderBoxes();
    renderPacking();
    renderDims();
    renderMaster();
    renderWarehouse();
    renderSummary();
    PF.icons();
  }
  // Cheap refresh that leaves the table being typed in untouched
  function renderDerived() {
    renderVariationSummary();
    renderBoxes();
    renderPacking();
    renderDims();
    renderMaster();
    renderWarehouse();
    renderSummary();
    PF.icons();
  }

  // ---- Interactions ----------------------------------------------------------------------------

  const touched = () => { if (F().validation) F().validation = null; PF.emit('change', { path: 'fby' }); };

  document.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-fby-select]');
    if (!sel) return;
    const id = sel.dataset.fbySelect;
    F().selected[id] = sel.checked;
    if (sel.checked && !F().sendQty[id]) F().sendQty[id] = '';
    renderAll();
    touched();
    if (sel.checked) { const q = PF.$(`[data-fby-qty="${CSS.escape(id)}"]`); if (q) q.focus(); }
  });
  document.addEventListener('input', (e) => {
    const q = e.target.closest('[data-fby-qty]');
    if (q) { F().sendQty[q.dataset.fbyQty] = q.value; q.classList.remove('is-invalid'); renderDerived(); touched(); return; }
    const pb = e.target.closest('[data-per-box-qty]');
    if (pb) { F().perBox[Number(pb.dataset.perBoxQty)] = pb.value; pb.classList.remove('is-invalid'); renderDerived(); touched(); return; }
    const bd = e.target.closest('[data-box-dim]');
    if (bd) {
      const i = Number(bd.dataset.boxDim);
      F().boxDims[i] = { ...(F().boxDims[i] || {}), [bd.dataset.dim]: bd.value };
      bd.classList.remove('is-invalid');
      renderSummary();
      touched();
    }
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-run-validation]')) {
      const ok = PF.runFbyValidation();
      PF.toast(ok ? 'All information is valid!' : 'Validation found issues — see the details.', ok ? undefined : 'error');
      return;
    }
    const t = e.target.closest('[data-validation-toggle]');
    if (t) {
      const list = PF.$('[data-validation-list]');
      if (!F().validation) PF.runFbyValidation();
      list.hidden = !list.hidden;
      t.setAttribute('aria-expanded', String(!list.hidden));
      return;
    }
    const focus = e.target.closest('[data-focus]');
    if (focus) {
      const input = PF.$(`.pf-step:not([hidden]) [name="${CSS.escape(focus.dataset.focus)}"]`);
      if (input) { input.focus(); input.select(); }
    }
  });

  // ---- Section validators & summaries ----------------------------------------------------------

  PF.validators['y-type'] = () => (S().fulfillment === 'fby' ? [] : [{ msg: 'Choose FBY (Warehouse Fulfilled) to continue on this page.' }]);
  PF.validators['y-inventory'] = () => {
    const sel = selectedUnits();
    if (!sel.length) return [{ msg: 'Select at least one variation to send.' }];
    const errors = [];
    sel.forEach((u) => {
      const input = PF.$(`[data-fby-qty="${CSS.escape(u.id)}"]`);
      const cur = PF.currentInventory(u, PF.units().indexOf(u));
      if (!(sendQty(u) > 0)) errors.push({ el: input, msg: 'Enter a quantity to send for every selected variation.', general: true });
      else if (sendQty(u) > cur) errors.push({ el: input, msg: `${PF.unitName(u)}: quantity to send is more than current inventory (${cur}).`, general: true });
    });
    return errors;
  };
  PF.validators['y-boxes'] = () => {
    const errors = [];
    if (F().packingMethod === 'different') {
      PF.$$('[data-per-box-qty]').forEach((el) => { if (!(PF.int(el.value) > 0)) errors.push({ el, msg: 'Enter the number of items in every box.', general: true }); });
    }
    if (!errors.length && PF.int(F().boxes) > 0 && boxTotal() !== totalUnits()) {
      errors.push({ msg: `Total quantity (${boxTotal()}) must equal the units selected to send (${totalUnits()}).` });
    }
    return errors;
  };
  PF.validators['y-packing'] = () => {
    const { leftover, empty } = allocate();
    if (leftover) return [{ msg: `${leftover} units do not fit with one variation per box — add boxes or pack multiple variations per box.` }];
    if (empty) return [{ msg: `${empty} box(es) would be empty with this packing — reduce the number of boxes.` }];
    return [];
  };
  PF.validators['y-dims'] = () => {
    if (F().sameDims) return [];
    const errors = [];
    PF.$$('[data-box-dim]').forEach((el) => { if (!(PF.num(el.value) > 0)) errors.push({ el, msg: 'Enter all dimensions and weights for every box.', general: true }); });
    return errors.slice(0, 1).concat(errors.slice(1).map((e) => ({ ...e, general: false })));
  };
  PF.validators['y-master'] = () => {
    if (F().useMaster !== 'yes') return [];
    const cap = PF.int(F().masterCount) * PF.int(F().boxesPerMaster);
    return cap && cap < PF.int(F().boxes) ? [{ msg: `Master cartons hold ${cap} boxes but you have ${PF.int(F().boxes)} boxes.` }] : [];
  };
  PF.validators['y-arrival'] = () => {
    const today = new Date().toISOString().slice(0, 10);
    return F().arrivalDate && F().arrivalDate < today ? [{ el: PF.$('[name="fby.arrivalDate"]'), msg: 'Choose today or a future date.' }] : [];
  };
  PF.validators['y-summary'] = () => (PF.runFbyValidation() ? [] : [{ msg: 'Fix the validation issues listed above before continuing.' }]);

  PF.summaries['y-type'] = () => 'FBY (Warehouse Fulfilled)';
  PF.summaries['y-inventory'] = () => `${selectedUnits().length} / ${PF.units().length} variations · ${totalUnits()} units to send`;
  PF.summaries['y-boxes'] = () => (F().packingMethod === 'different' ? `${PF.int(F().boxes)} boxes (different quantities) · ${boxTotal()} units` : `${PF.int(F().boxes)} boxes × ${PF.int(F().itemsPerBox)} items = ${boxTotal()} units`);
  PF.summaries['y-packing'] = () => (F().variationPacking === 'one' ? 'One variation per box' : 'Multiple variations per box');
  PF.summaries['y-dims'] = () => (F().sameDims ? `${PF.num(F().length)} × ${PF.num(F().width)} × ${PF.num(F().height)} ${unitLabel()} · ${PF.num(F().weight)} ${weightLabel()}` : 'Dimensions set per box');
  PF.summaries['y-packaging'] = () => `${F().packagingType || '—'} · ${F().unitsPerCase || 0} units per case · Individual packaging: ${F().individualPackaging === 'yes' ? 'Yes' : 'No'}`;
  PF.summaries['y-master'] = () => (F().useMaster === 'yes' ? `${PF.int(F().masterCount)} master cartons × ${PF.int(F().boxesPerMaster)} boxes` : 'No master cartons');
  PF.summaries['y-warehouse'] = () => ((PF.options.warehouses || []).find((w) => w.id === F().warehouse) || {}).name || '';
  PF.summaries['y-arrival'] = () => `${F().arrivalDate}${F().arrivalWindow ? ` · ${F().arrivalWindow}` : ''}${F().tracking ? ` · Tracking ${F().tracking}` : ''}`;
  PF.summaries['y-summary'] = () => 'All information is valid';

  // Everything Page 3 needs from this page, computed with the same allocation used here
  PF.fbyPlan = () => {
    const { boxes } = allocate();
    const f = F();
    const perBoxDims = (i) => (f.sameDims ? f : (f.boxDims[i] || {}));
    const planBoxes = boxes.map((b, i) => {
      const d = perBoxDims(i);
      return {
        index: i,
        label: `Box ${String(i + 1).padStart(2, '0')}`,
        items: b.items.map((it) => ({ unit: it.unit, qty: it.qty })),
        qty: b.items.reduce((a, it) => a + it.qty, 0),
        weight: PF.num(d.weight),
        dims: [PF.num(d.length), PF.num(d.width), PF.num(d.height)],
      };
    });
    const masters = [];
    if (f.useMaster === 'yes') {
      const per = PF.int(f.boxesPerMaster);
      for (let c = 0; c < PF.int(f.masterCount); c += 1) {
        masters.push({ index: c, label: `Master Carton ${String(c + 1).padStart(2, '0')}`, boxes: planBoxes.slice(c * per, c * per + per).map((b) => b.index) });
      }
    }
    return {
      units: selectedUnits().map((u) => ({ unit: u, qty: sendQty(u) })),
      totalUnits: totalUnits(),
      boxes: planBoxes,
      dimUnit: unitLabel(),
      weightUnit: weightLabel(),
      totalWeight: planBoxes.reduce((a, b) => a + b.weight, 0),
      masters,
      warehouse: (PF.options.warehouses || []).find((w) => w.id === f.warehouse) || null,
      arrivalDate: f.arrivalDate,
      arrivalWindow: f.arrivalWindow,
    };
  };

  PF.initFby = () => {
    renderAll();
    PF.on('variations-changed', renderAll);
    PF.on('units-soft-changed', () => renderAll());
    PF.on('change', ({ path }) => {
      if (!path) return;
      if (path.startsWith('fby.')) {
        if (path !== 'fby.validation') F().validation = null;
        renderDerived();
      } else if (['basic.nameEn', 'basic.sku', 'media.thumbnail'].includes(path)) {
        renderAll();
      }
    });
  };
})();
