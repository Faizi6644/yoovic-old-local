/* FBY Page 3 — Barcodes, Handling & Shipping.
   All numbers come from Page 1 + FBY Page 2 (PF.fbyPlan). Barcode numbers are unique, issued by the server.
   Carrier rates, tracking numbers and labels are mock data until a carrier API exists. */
(function () {
  const PF = window.PF;
  const S = () => PF.state;
  const Z = () => PF.state.fby3;

  const pad2 = (n) => String(n).padStart(2, '0');
  const plan = () => PF.fbyPlan();
  const handlingName = (id) => ((PF.options.handlingCategories || []).find((c) => c.id === id) || {}).label || '';
  const unitHandling = (u) => (Z().applyAll ? Z().handling : (Z().perVariation[u.id] || Z().handling));
  const kg = (p) => p.totalWeight * (p.weightUnit === 'lb' ? 0.4536 : 1);
  const fmtWeight = (w, unit) => `${Math.round(w * 100) / 100} ${unit}`;

  // ---- Barcodes ------------------------------------------------------------------------------

  const varCode = (u) => Z().barcodes.variation[u.id];
  const boxCode = (i) => Z().barcodes.box[i];
  const masterCode = (i) => Z().barcodes.master[i];

  function missing(p) {
    return {
      variation: p.units.filter(({ unit }) => !varCode(unit)).length,
      box: Math.max(0, p.boxes.length - Z().barcodes.box.length),
      master: Math.max(0, p.masters.length - Z().barcodes.master.length),
    };
  }

  let allocating = null;
  // Requests numbers only for barcodes that don't exist yet; existing numbers never change
  PF.ensureBarcodes = async () => {
    if (allocating) return allocating;
    const p = plan();
    const need = missing(p);
    if (!need.variation && !need.box && !need.master) return null;
    allocating = (async () => {
      if (!PF.draftId) await PF.saveDraft({ silent: true });
      if (!PF.draftId) throw new Error('Save the draft first.');
      const res = await fetch(`/api/products/drafts/${PF.draftId}/barcodes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(need),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not generate barcodes.');
      const codes = { ...body };
      p.units.forEach(({ unit }) => { if (!varCode(unit)) Z().barcodes.variation[unit.id] = codes.variation.shift(); });
      Z().barcodes.box.push(...codes.box);
      Z().barcodes.master.push(...codes.master);
      PF.emit('change', { path: 'fby3.barcodes' });
      renderAll();
      PF.saveDraft({ silent: true });
    })().catch((err) => PF.toast(err.message, 'error')).finally(() => { allocating = null; });
    return allocating;
  };

  function barcodeItems(kind) {
    const p = plan();
    const items = [];
    if (kind === 'variation' || kind === 'all') {
      p.units.forEach(({ unit, qty }) => items.push({ title: PF.unitName(unit), lines: [`SKU: ${unit.sku || S().basic.sku}`, `Quantity: ${qty}`], code: varCode(unit) }));
    }
    if (kind === 'box' || kind === 'all') {
      p.boxes.forEach((b) => items.push({ title: b.label, lines: [contentsText(b), `Quantity: ${b.qty} · ${fmtWeight(b.weight, p.weightUnit)}`], code: boxCode(b.index) }));
    }
    if (kind === 'master' || kind === 'all') {
      p.masters.forEach((m) => items.push({ title: m.label, lines: [`Boxes: ${m.boxes.map((i) => pad2(i + 1)).join(', ')}`], code: masterCode(m.index) }));
    }
    return items.filter((it) => it.code);
  }
  const contentsText = (b) => b.items.map((it) => `${PF.unitName(it.unit)} × ${it.qty}`).join(', ');

  // ---- Shipping ------------------------------------------------------------------------------------

  PF.carrierRates = () => {
    const p = plan();
    return (PF.options.yoovicCarriers || []).map((c) => ({ ...c, weight: fmtWeight(p.totalWeight, p.weightUnit), rate: c.base + c.perKg * kg(p) + c.perBox * p.boxes.length }));
  };
  const selectedCarrier = () => PF.carrierRates().find((c) => c.id === Z().yoovicCarrier) || null;

  function shipping() {
    const p = plan();
    if (Z().method === 'yoovic') {
      const c = selectedCarrier();
      return {
        method: 'yoovic', methodLabel: 'Yoovic Shipping', carrier: c ? c.name : '', service: c ? c.service : '',
        rate: c ? `$${c.rate.toFixed(2)}` : '—', trackingFor: (i) => Z().yoovicTracking[i] || '',
        trackingStatus: 'Generated', complete: Boolean(c) && p.boxes.every((b) => Z().yoovicTracking[b.index]),
      };
    }
    const same = Z().trackingMode !== 'individual';
    return {
      method: 'self', methodLabel: 'Self-Arranged Shipping', carrier: Z().carrier, service: 'Seller Arranged', rate: 'Paid by seller',
      trackingFor: (i) => (same ? Z().tracking : Z().boxTracking[i] || '').trim(),
      trackingStatus: 'Provided',
      complete: Boolean(Z().carrier) && p.boxes.every((b) => /^[A-Za-z0-9-]{6,40}$/.test((same ? Z().tracking : Z().boxTracking[b.index] || '').trim())),
    };
  }

  // Labels are valid only for the shipping details they were generated with
  const labelsKey = () => {
    const p = plan();
    const sh = shipping();
    return JSON.stringify([sh.method, sh.carrier, p.boxes.map((b) => [boxCode(b.index), sh.trackingFor(b.index), b.weight])]);
  };
  const labelsReady = () => Z().labelsGenerated && Z().labelsKey === labelsKey();

  function labelData() {
    const p = plan();
    const sh = shipping();
    const seller = window.PF_SELLER || {};
    return p.boxes.map((b) => ({
      carrier: sh.carrier || '—', service: sh.service,
      from: { name: seller.store || 'Seller', line: seller.country || '' },
      to: { name: p.warehouse ? p.warehouse.name : '—', address: p.warehouse ? p.warehouse.address : '' },
      boxLabel: b.label, index: b.index, total: p.boxes.length,
      tracking: sh.trackingFor(b.index), boxBarcode: boxCode(b.index),
      weight: fmtWeight(b.weight, p.weightUnit), dims: `${b.dims.join(' × ')} ${p.dimUnit}`,
      handling: [...new Set(b.items.map((it) => handlingName(unitHandling(it.unit))))].join(', '),
      ref: (S().shipment && S().shipment.code) || `Draft #${PF.draftId || '—'}`,
    }));
  }

  // ---- Checklist -------------------------------------------------------------------------------

  PF.fby3Checklist = () => {
    const p = plan();
    const sh = shipping();
    const list = [
      { text: 'Handling Category Selected', ok: Boolean(Z().handling) && p.units.every(({ unit }) => Boolean(unitHandling(unit))) },
      { text: 'Variation Barcodes Generated', ok: p.units.length > 0 && p.units.every(({ unit }) => varCode(unit)) },
      { text: 'Box Barcodes Generated', ok: p.boxes.length > 0 && p.boxes.every((b) => boxCode(b.index)) },
    ];
    if (p.masters.length) list.push({ text: 'Master Carton Barcodes Generated', ok: p.masters.every((m) => masterCode(m.index)) });
    list.push(
      { text: 'Shipping Method Selected', ok: sh.method === 'self' || Boolean(selectedCarrier()) },
      { text: 'Shipping Information Complete', ok: sh.complete },
      { text: 'Tracking Generated / Provided', ok: p.boxes.length > 0 && p.boxes.every((b) => sh.trackingFor(b.index)) },
      { text: 'Shipping Labels Ready', ok: labelsReady() },
    );
    return list;
  };

  // ---- Rendering -----------------------------------------------------------------------------------

  const barcodeCell = (code) => (code ? `<div class="pf-barcode">${PF.barcodeSvg(code, { height: 34, width: 1.3, fontSize: 11 })}</div>` : '<span class="pf-muted-cell">Generating…</span>');
  const rowActions = (kind, key) => `<div class="pf-row-actions">
      <button type="button" class="pf-edit-btn" data-bc-view="${kind}:${key}"><i data-lucide="eye"></i> View</button>
      <button type="button" class="pf-edit-btn" data-bc-print-one="${kind}:${key}"><i data-lucide="printer"></i> Print</button></div>`;

  function renderHandling() {
    PF.fill('fby3.handling');
    PF.fill('fby3.applyAll');
    const hint = PF.$('[data-handling-hint]');
    if (hint) hint.hidden = Z().applyAll;
  }

  function renderVarBarcodes() {
    const body = PF.$('[data-var-barcodes]');
    if (!body) return;
    const p = plan();
    const perVar = !Z().applyAll;
    PF.$$('[data-handling-col]').forEach((th) => { th.hidden = !perVar; });
    body.innerHTML = p.units.map(({ unit, qty }) => `<tr>
        <td><div class="pf-cell-var"><img src="${PF.esc(PF.unitImage(unit))}" alt="">${PF.esc(PF.unitName(unit))}</div></td>
        <td>${PF.esc(unit.sku || S().basic.sku)}</td>
        <td>${qty}</td>
        ${perVar ? `<td><select class="pf-input pf-select" data-var-handling="${unit.id}" aria-label="Handling category for ${PF.esc(PF.unitName(unit))}">
          ${(PF.options.handlingCategories || []).map((c) => `<option value="${c.id}"${unitHandling(unit) === c.id ? ' selected' : ''}>${PF.esc(c.label)}</option>`).join('')}</select></td>` : ''}
        <td>${barcodeCell(varCode(unit))}</td>
        <td>${rowActions('variation', unit.id)}</td>
      </tr>`).join('') || '<tr><td colspan="6" class="pf-muted-cell">No variations selected on Page 2.</td></tr>';
  }

  function renderBoxBarcodes() {
    const body = PF.$('[data-box-barcodes]');
    if (!body) return;
    const p = plan();
    if (Z().selectedBox >= p.boxes.length) Z().selectedBox = 0;
    body.innerHTML = p.boxes.map((b) => {
      const mixed = new Set(b.items.map((it) => it.unit.id)).size > 1;
      return `<tr class="pf-row-click${b.index === Z().selectedBox ? ' is-selected' : ''}" data-box-row="${b.index}" tabindex="0" aria-label="Show details for ${b.label}">
        <td>${b.label}</td>
        <td title="${PF.esc(contentsText(b))}">${mixed ? 'Mixed' : PF.esc(b.items[0] ? PF.unitName(b.items[0].unit) : '—')}</td>
        <td>${b.qty}</td>
        <td>${fmtWeight(b.weight, p.weightUnit)}</td>
        <td>${barcodeCell(boxCode(b.index))}</td>
        <td>${rowActions('box', b.index)}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" class="pf-muted-cell">No boxes configured on Page 2.</td></tr>';
    renderBoxDetails();
  }

  function renderBoxDetails() {
    const dl = PF.$('[data-box-details]');
    if (!dl) return;
    const p = plan();
    const b = p.boxes[Z().selectedBox];
    if (!b) { dl.innerHTML = ''; return; }
    const kv = (k, v) => `<dt>${k}:</dt><dd>${PF.esc(v)}</dd>`;
    dl.innerHTML = kv('Shipment ID', (S().shipment && S().shipment.code) || 'Assigned on submit')
      + kv('Box ID', boxCode(b.index) || 'Generating…')
      + kv('Box', `${b.label} of ${pad2(p.boxes.length)}`)
      + kv('Product', S().basic.nameEn)
      + kv('YPIN', [...new Set(b.items.map((it) => it.unit.ypin))].join(', '))
      + kv('Warehouse', p.warehouse ? p.warehouse.name : '—')
      + kv('Box Contents', contentsText(b))
      + kv('Variation SKUs', b.items.map((it) => it.unit.sku || S().basic.sku).join(', '))
      + kv('Quantities', String(b.qty))
      + kv('Dimensions', `${b.dims.join(' × ')} ${p.dimUnit}`)
      + kv('Weight', fmtWeight(b.weight, p.weightUnit))
      + kv('Handling Category', [...new Set(b.items.map((it) => handlingName(unitHandling(it.unit))))].join(', '));
  }

  function renderMasters() {
    const p = plan();
    const section = PF.$('.pf-section[data-section="z-master"]');
    if (section) {
      const hide = !p.masters.length;
      if (section.hidden !== hide) { section.hidden = hide; PF.renderSections('fby3'); }
    }
    const box = PF.$('[data-master-barcodes]');
    if (!box) return;
    box.innerHTML = p.masters.map((m) => `<div class="pf-master-card">
        <span class="pf-master-card__icon"><i data-lucide="package"></i></span>
        <div class="pf-master-card__code"><strong>${m.label}</strong>${barcodeCell(masterCode(m.index))}</div>
        <div class="pf-master-card__boxes"><span>Boxes:</span><ul>${m.boxes.map((i) => `<li>Box ${pad2(i + 1)}</li>`).join('') || '<li class="pf-muted-cell">Empty</li>'}</ul></div>
        ${rowActions('master', m.index)}
      </div>`).join('');
  }

  function renderSummary() {
    const box = PF.$('[data-barcode-summary]');
    if (!box) return;
    const p = plan();
    const card = (label, have, total) => `<div class="pf-bc-card">
        <span class="pf-validation__icon ${have === total && total ? 'is-ok' : 'is-idle'}"><i data-lucide="${have === total && total ? 'check' : 'loader'}"></i></span>
        <div><small>${label}</small><strong>${have} / ${total} Generated</strong></div></div>`;
    box.innerHTML = card('Variation Barcodes', p.units.filter(({ unit }) => varCode(unit)).length, p.units.length)
      + card('Box Barcodes', p.boxes.filter((b) => boxCode(b.index)).length, p.boxes.length)
      + (p.masters.length ? card('Master Carton Barcodes', p.masters.filter((m) => masterCode(m.index)).length, p.masters.length) : '');
  }

  function renderShipping() {
    const p = plan();
    PF.fill('fby3.method');
    PF.fill('fby3.carrier');
    PF.fill('fby3.tracking');
    PF.fill('fby3.trackingMode');
    PF.$$('[data-method-card]').forEach((c) => c.classList.toggle('is-active', c.dataset.methodCard === Z().method));
    // Self-arranged fields only count (and validate) when that method is chosen
    PF.$$('[data-method-body="self"] input, [data-method-body="self"] select').forEach((el) => { el.disabled = Z().method !== 'self'; });
    const individual = Z().trackingMode === 'individual';
    PF.$$('[data-same-tracking]').forEach((el) => { el.hidden = individual; });
    const perBox = PF.$('[data-box-tracking]');
    if (perBox) {
      perBox.hidden = !individual;
      if (individual && perBox.querySelectorAll('[data-box-tracking-input]').length !== p.boxes.length) {
        perBox.innerHTML = `<div class="pf-table-wrap"><table class="pf-table pf-table--compact"><thead><tr><th>Box</th><th>Tracking Number <span class="pf-req">*</span></th></tr></thead><tbody>
          ${p.boxes.map((b) => `<tr><td>${b.label}</td><td><input class="pf-input" data-box-tracking-input="${b.index}" value="${PF.esc(Z().boxTracking[b.index] || '')}" placeholder="Enter tracking number" aria-label="Tracking number for ${b.label}"></td></tr>`).join('')}
          </tbody></table></div>`;
      }
    }
    const rates = PF.$('[data-carrier-rates]');
    if (rates) {
      rates.innerHTML = PF.carrierRates().map((c) => {
        const on = Z().method === 'yoovic' && Z().yoovicCarrier === c.id;
        return `<tr class="${on ? 'is-selected' : ''}">
          <td><span class="pf-carrier"><span class="pf-carrier__dot" style="background:${c.color}"></span>${PF.esc(c.name)}</span></td>
          <td>${PF.esc(c.service)}</td><td>${PF.esc(c.delivery)}</td><td>${PF.esc(c.weight)}</td><td>$${c.rate.toFixed(2)}</td>
          <td><button type="button" class="btn btn--sm ${on ? 'pf-btn-go' : 'btn--primary'}" data-carrier-select="${c.id}" aria-pressed="${on}">${on ? '<i data-lucide="check"></i> Selected' : 'Select'}</button></td></tr>`;
      }).join('');
    }
  }

  // Switching method or carrier makes earlier shipping errors irrelevant
  function clearShippingErrors() {
    const section = PF.$('[data-section="z-shipping"]');
    if (!section) return;
    const box = section.querySelector('[data-section-error]');
    if (box && !box.classList.contains('is-notice')) box.hidden = true;
    PF.$$('.pf-invalid', section).forEach((f) => f.classList.remove('pf-invalid'));
    PF.$$('.is-invalid', section).forEach((f) => f.classList.remove('is-invalid'));
    PF.$$('.pf-error', section).forEach((m) => { m.hidden = true; });
  }

  function renderLabels() {
    const strip = PF.$('[data-label-strip]');
    if (!strip) return;
    const p = plan();
    const sh = shipping();
    const ready = labelsReady();
    const hasTracking = p.boxes.length && p.boxes.every((b) => sh.trackingFor(b.index));
    const cell = (k, v, ok) => `<div><small>${k}</small><strong>${ok === undefined ? '' : `<i data-lucide="${ok ? 'circle-check' : 'circle-x'}" class="${ok ? 'is-ok' : 'is-bad'}"></i> `}${PF.esc(v)}</strong></div>`;
    strip.innerHTML = cell('Selected Carrier', sh.carrier || '—') + cell('Service', sh.service || '—') + cell('Rate', sh.rate)
      + cell('Tracking', hasTracking ? sh.trackingStatus : 'Missing', Boolean(hasTracking))
      + cell('Shipping Labels', `${ready ? p.boxes.length : 0} / ${p.boxes.length} Generated`, ready);
    const gen = PF.$('[data-generate-labels]');
    if (gen) gen.innerHTML = `<i data-lucide="${ready ? 'refresh-cw' : 'file-text'}"></i> ${ready ? 'Regenerate Labels' : Z().labelsGenerated ? 'Regenerate Labels (details changed)' : 'Generate Labels for All Boxes'}`;
    const cards = PF.$('[data-label-cards]');
    if (!ready) {
      cards.innerHTML = `<p class="pf-muted-cell pf-label-empty">${Z().labelsGenerated ? 'Shipping details changed since the labels were generated. Generate them again.' : 'Generate labels to see them here.'}</p>`;
      return;
    }
    const data = labelData();
    const shown = data.slice(0, 3);
    cards.innerHTML = shown.map((l) => `<div class="pf-label-card">
        <div class="pf-label-thumb" aria-hidden="true"><div class="pf-label-thumb__inner">${PF.labelHtml(l)}</div></div>
        <div class="pf-label-card__info"><strong>${l.boxLabel}</strong>
          <span>Tracking: ${PF.esc(l.tracking)}</span><span>Carrier: ${PF.esc(l.carrier)}</span><span>Service: ${PF.esc(l.service)}</span><span>Weight: ${PF.esc(l.weight)}</span>
          <button type="button" class="pf-edit-btn" data-label-view="${l.index}"><i data-lucide="eye"></i> View / Print</button></div>
      </div>`).join('') + (data.length > 3 ? `<p class="pf-muted-cell pf-label-more">+ ${data.length - 3} more label${data.length - 3 === 1 ? '' : 's'} — use Print Label to print all ${data.length}.</p>` : '');
  }

  function renderReview() {
    const product = PF.$('[data-review-product]');
    if (!product) return;
    const p = plan();
    const sh = shipping();
    const kv = (k, v) => `<dt>${k}:</dt><dd>${PF.esc(v)}</dd>`;
    const date = p.arrivalDate ? new Date(`${p.arrivalDate}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
    const trackings = [...new Set(p.boxes.map((b) => sh.trackingFor(b.index)).filter(Boolean))];
    product.innerHTML = `<img class="pf-review__img" src="${PF.esc(S().media.thumbnail || PF.placeholderImg)}" alt="">
      <dl class="pf-kv pf-kv--left">${kv('Product', S().basic.nameEn)}${kv('YPIN', S().product.ypin)}
        ${kv('Variations', `${p.units.length} (${p.units.map(({ unit }) => PF.unitName(unit)).join(', ')})`)}
        ${kv('Total Units', String(p.totalUnits))}${kv('Total Boxes', String(p.boxes.length))}
        ${kv('Master Cartons', p.masters.length ? String(p.masters.length) : 'Not used')}</dl>`;
    PF.$('[data-review-shipment]').innerHTML = kv('Handling Category', Z().applyAll ? handlingName(Z().handling) : 'Per variation')
      + kv('Warehouse', p.warehouse ? p.warehouse.name : '—')
      + kv('Expected Arrival', date + (p.arrivalWindow ? ` (${p.arrivalWindow})` : ''))
      + kv('Shipping Method', sh.methodLabel) + kv('Carrier', sh.carrier || '—') + kv('Service', sh.service || '—') + kv('Rate', sh.rate)
      + kv('Tracking', trackings.length === 1 ? trackings[0] : trackings.length ? `${trackings.length} tracking numbers` : '—');
    PF.$('[data-review-checklist]').innerHTML = PF.fby3Checklist().map((c) => `<li class="${c.ok ? 'is-ok' : 'is-bad'}"><i data-lucide="${c.ok ? 'circle-check' : 'circle-x'}"></i>${PF.esc(c.text)}</li>`).join('');
  }

  function renderAll() {
    renderHandling();
    renderVarBarcodes();
    renderBoxBarcodes();
    renderMasters();
    renderSummary();
    renderShipping();
    renderLabels();
    renderReview();
    PF.icons();
  }
  PF.renderFby3 = renderAll;

  // ---- Dialogs & printing ------------------------------------------------------------------

  function findItem(kind, key) {
    const p = plan();
    if (kind === 'variation') { const e = p.units.find(({ unit }) => unit.id === key); return e && { title: PF.unitName(e.unit), lines: [`SKU: ${e.unit.sku || S().basic.sku}`, `Quantity: ${e.qty}`, `YPIN: ${e.unit.ypin}`], code: varCode(e.unit) }; }
    if (kind === 'box') { const b = p.boxes[Number(key)]; return b && { title: b.label, lines: [contentsText(b), `Quantity: ${b.qty}`, `Weight: ${fmtWeight(b.weight, p.weightUnit)}`], code: boxCode(b.index) }; }
    const m = p.masters[Number(key)];
    return m && { title: m.label, lines: [`Boxes: ${m.boxes.map((i) => pad2(i + 1)).join(', ')}`], code: masterCode(m.index) };
  }

  let modalPrint = null;
  function showBarcodeModal(title, items) {
    PF.$('[data-barcode-title]').textContent = title;
    PF.$('[data-barcode-hint]').textContent = `${items.length} barcode${items.length === 1 ? '' : 's'} · Code 128 · scannable`;
    PF.$('[data-barcode-body]').innerHTML = `<div class="pf-bc-grid">${items.map((it) => `<div class="pf-bc-tile"><strong>${PF.esc(it.title)}</strong>${it.lines.map((l) => `<small>${PF.esc(l)}</small>`).join('')}<div class="pf-barcode pf-barcode--lg">${PF.barcodeSvg(it.code, { height: 60, width: 2 })}</div></div>`).join('')}</div>`;
    modalPrint = () => PF.openPrintPage({ title, items });
    PF.openModal('pf-barcode-modal');
  }
  function showLabelModal(index) {
    const l = labelData()[index];
    if (!l) return;
    PF.$('[data-barcode-title]').textContent = `Shipping Label – ${l.boxLabel}`;
    PF.$('[data-barcode-hint]').textContent = `${l.carrier} · ${l.service} · 4 × 6 in`;
    PF.$('[data-barcode-body]').innerHTML = `<div class="pf-label-preview">${PF.labelHtml(l)}</div>`;
    modalPrint = () => PF.openPrintPage({ title: `Shipping Label – ${l.boxLabel}`, labels: [l] });
    PF.openModal('pf-barcode-modal');
  }

  const needLabels = () => {
    if (labelsReady()) return true;
    PF.toast('Generate the shipping labels first.', 'error');
    return false;
  };
  const titles = { variation: 'Variation Barcodes', box: 'Box Barcodes', master: 'Master Carton Barcodes', all: 'All Shipment Barcodes' };

  document.addEventListener('click', async (e) => {
    const t = e.target;
    const preview = t.closest('[data-bc-preview]');
    if (preview) { showBarcodeModal(titles[preview.dataset.bcPreview], barcodeItems(preview.dataset.bcPreview)); return; }
    const print = t.closest('[data-bc-print]');
    if (print) {
      const items = barcodeItems(print.dataset.bcPrint);
      if (!items.length) { PF.toast('No barcodes generated yet.', 'error'); return; }
      PF.openPrintPage({ title: titles[print.dataset.bcPrint], items, download: print.hasAttribute('data-download') });
      return;
    }
    const view = t.closest('[data-bc-view]');
    if (view) { const [k, key] = view.dataset.bcView.split(':'); const it = findItem(k, key); if (it) showBarcodeModal(it.title, [it]); return; }
    const one = t.closest('[data-bc-print-one]');
    if (one) { const [k, key] = one.dataset.bcPrintOne.split(':'); const it = findItem(k, key); if (it && it.code) PF.openPrintPage({ title: it.title, items: [it] }); return; }
    if (t.closest('[data-barcode-modal-print]') && modalPrint) { modalPrint(); return; }

    const row = t.closest('[data-box-row]');
    if (row && !t.closest('button')) { Z().selectedBox = Number(row.dataset.boxRow); renderBoxBarcodes(); PF.icons(); return; }

    const pick = t.closest('[data-carrier-select]');
    if (pick) {
      PF.markEdited(pick);
      Z().method = 'yoovic';
      Z().yoovicCarrier = pick.dataset.carrierSelect;
      Z().yoovicTracking = plan().boxes.map((b) => PF.mockTracking(Z().yoovicCarrier, b.index + 1));
      clearShippingErrors();
      PF.emit('change', { path: 'fby3.yoovicCarrier' });
      renderAll();
      return;
    }
    if (t.closest('[data-generate-labels]')) {
      const sh = shipping();
      if (!sh.complete) { PF.toast(Z().method === 'yoovic' ? 'Select a Yoovic Shipping carrier first.' : 'Enter the carrier and tracking number(s) in Shipping Method first.', 'error'); return; }
      if (!plan().boxes.every((b) => boxCode(b.index))) { PF.toast('Box barcodes are still being generated.', 'error'); return; }
      PF.markEdited(t);
      Z().labelsGenerated = true;
      Z().labelsKey = labelsKey();
      const errBox = PF.$('[data-section="z-labels"] [data-section-error]');
      if (errBox && !errBox.classList.contains('is-notice')) errBox.hidden = true;
      PF.emit('change', { path: 'fby3.labelsGenerated' });
      renderAll();
      PF.toast(`${plan().boxes.length} shipping label${plan().boxes.length === 1 ? '' : 's'} generated.`);
      return;
    }
    if (t.closest('[data-label-preview]')) { if (needLabels()) showLabelModal(Math.min(Z().selectedBox, plan().boxes.length - 1)); return; }
    const lv = t.closest('[data-label-view]');
    if (lv) { showLabelModal(Number(lv.dataset.labelView)); return; }
    const lp = t.closest('[data-label-print]');
    if (lp) { if (PF.submitted || needLabels()) PF.openPrintPage({ title: 'Shipping Labels', labels: labelData(), download: lp.hasAttribute('data-download') }); return; }
    if (t.closest('[data-submit-fby]')) submit();
  });

  document.addEventListener('keydown', (e) => {
    const row = e.target.closest && e.target.closest('[data-box-row]');
    if (row && (e.key === 'Enter' || e.key === ' ') && e.target === row) { e.preventDefault(); row.click(); }
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('[data-box-scan]')) {
      const code = t.value.replace(/\D/g, '');
      const err = PF.$('[data-box-scan-error]');
      err.hidden = true;
      if (code.length < 12) return;
      const i = Z().barcodes.box.indexOf(code);
      if (i >= 0 && i < plan().boxes.length) { Z().selectedBox = i; renderBoxBarcodes(); PF.icons(); return; }
      const unit = plan().units.find(({ unit: u }) => varCode(u) === code);
      err.textContent = unit ? `That is the variation barcode for ${PF.unitName(unit.unit)}, not a box.` : 'No box in this shipment has that barcode.';
      err.hidden = false;
      return;
    }
    if (t.matches('[data-box-tracking-input]')) {
      Z().boxTracking[Number(t.dataset.boxTrackingInput)] = t.value;
      PF.emit('change', { path: 'fby3.boxTracking' });
      renderLabels(); renderReview(); PF.icons();
    }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-var-handling]')) {
      Z().perVariation[t.dataset.varHandling] = t.value;
      PF.emit('change', { path: 'fby3.perVariation' });
      renderBoxDetails(); renderReview(); PF.icons();
    }
  });

  // ---- Submit --------------------------------------------------------------------------------

  function shipmentSummary() {
    const p = plan();
    const sh = shipping();
    return {
      warehouse: p.warehouse ? p.warehouse.id : '', warehouseName: p.warehouse ? p.warehouse.name : '',
      arrivalDate: p.arrivalDate, arrivalWindow: p.arrivalWindow,
      totalUnits: p.totalUnits, totalBoxes: p.boxes.length,
      method: sh.method, carrier: sh.carrier, service: sh.service, rate: sh.rate,
      labelsGenerated: labelsReady(),
      handling: Z().applyAll ? Z().handling : 'per-variation',
      variations: p.units.map(({ unit, qty }) => ({ id: unit.id, name: PF.unitName(unit), sku: unit.sku || S().basic.sku, qty, barcode: varCode(unit), handling: unitHandling(unit) })),
      boxes: p.boxes.map((b) => ({ label: b.label, barcode: boxCode(b.index), tracking: sh.trackingFor(b.index), qty: b.qty, weight: b.weight, contents: contentsText(b) })),
      masters: p.masters.map((m) => ({ label: m.label, barcode: masterCode(m.index), boxes: m.boxes.map((i) => i + 1) })),
    };
  }

  let submitting = false;
  async function submit() {
    if (submitting) return;
    if (!PF.pageComplete('fby3') || !PF.fby3Checklist().every((c) => c.ok)) { PF.toast('Accept every section and fix the checklist first.', 'error'); return; }
    const p = plan();
    const ok = await PF.confirm({
      title: 'Submit FBY shipment?',
      message: `${p.totalUnits} units in ${p.boxes.length} box${p.boxes.length === 1 ? '' : 'es'} will be sent to ${p.warehouse ? p.warehouse.name : 'the warehouse'}. After submitting, this product can no longer be edited.`,
      confirmLabel: 'Submit Shipment', icon: 'send',
    });
    if (!ok) return;
    submitting = true;
    const btn = PF.$('[data-submit-fby]');
    btn.disabled = true;
    try {
      if (!PF.draftId) await PF.saveDraft({ silent: true });
      const res = await fetch(`/api/products/drafts/${PF.draftId}/submit-fby`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: S(), summary: shipmentSummary() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not submit the shipment.');
      S().shipment = { code: body.shipmentCode, submittedAt: new Date().toISOString() };
      PF.submitted = S().shipment;
      PF.markClean();
      PF.showStep('fby-done');
      PF.toast(`Shipment ${body.shipmentCode} submitted.`);
    } catch (err) {
      PF.toast(err.message, 'error');
      btn.disabled = false;
    } finally {
      submitting = false;
    }
  }

  PF.renderFbyDone = () => {
    const p = plan();
    const sh = shipping();
    PF.$('[data-done-id]').textContent = (PF.submitted && PF.submitted.code) || (S().shipment && S().shipment.code) || '—';
    const kv = (k, v) => `<dt>${k}:</dt><dd>${PF.esc(v)}</dd>`;
    const date = p.arrivalDate ? new Date(`${p.arrivalDate}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
    PF.$('[data-done-summary]').innerHTML = kv('Product', S().basic.nameEn) + kv('Variations', p.units.map(({ unit, qty }) => `${PF.unitName(unit)} × ${qty}`).join(', '))
      + kv('Total Units', String(p.totalUnits)) + kv('Total Boxes', String(p.boxes.length))
      + kv('Warehouse', p.warehouse ? p.warehouse.name : '—') + kv('Expected Arrival', date)
      + kv('Shipping', `${sh.methodLabel} · ${sh.carrier} ${sh.service}`);
    PF.icons();
  };

  // ---- Section validators & summaries -------------------------------------------------------------

  const codesDone = (kind) => {
    const p = plan();
    if (kind === 'variation') return p.units.length > 0 && p.units.every(({ unit }) => varCode(unit));
    if (kind === 'box') return p.boxes.length > 0 && p.boxes.every((b) => boxCode(b.index));
    return p.masters.every((m) => masterCode(m.index));
  };
  PF.validators['z-handling'] = () => (Z().handling ? [] : [{ msg: 'Select a handling category.' }]);
  PF.validators['z-var'] = () => (codesDone('variation') ? [] : [{ msg: 'Variation barcodes are still being generated — try again in a moment.' }]);
  PF.validators['z-box'] = () => (codesDone('box') ? [] : [{ msg: 'Box barcodes are still being generated — try again in a moment.' }]);
  PF.validators['z-master'] = () => (codesDone('master') ? [] : [{ msg: 'Master carton barcodes are still being generated.' }]);
  PF.validators['z-summary'] = () => (codesDone('variation') && codesDone('box') && codesDone('master') ? [] : [{ msg: 'Some barcodes are missing.' }]);
  PF.validators['z-shipping'] = () => {
    const sh = shipping();
    if (Z().method === 'yoovic') return selectedCarrier() ? [] : [{ msg: 'Select a Yoovic Shipping carrier.' }];
    const errors = [];
    if (Z().trackingMode === 'individual') {
      PF.$$('[data-box-tracking-input]').forEach((el) => { if (!/^[A-Za-z0-9-]{6,40}$/.test(el.value.trim())) errors.push({ el, msg: 'Enter a tracking number (6–40 letters or digits) for every box.', general: true }); });
    } else if (Z().tracking && !/^[A-Za-z0-9-]{6,40}$/.test(Z().tracking.trim())) {
      errors.push({ el: PF.$('[data-step="fby3"] [name="fby3.tracking"]'), msg: 'Enter a valid tracking number (6–40 letters or digits).' });
    }
    return errors.length || sh.complete ? errors : [{ msg: 'Complete the shipping information.' }];
  };
  PF.validators['z-labels'] = () => (labelsReady() ? [] : [{ msg: Z().labelsGenerated ? 'Shipping details changed — generate the labels again.' : 'Generate the shipping labels for all boxes.' }]);
  PF.validators['z-review'] = () => {
    const bad = PF.fby3Checklist().filter((c) => !c.ok);
    return bad.length ? [{ msg: `Fix the checklist first: ${bad.map((c) => c.text).join(', ')}.` }] : [];
  };

  PF.summaries['z-handling'] = () => (Z().applyAll ? `${handlingName(Z().handling)} · applied to all variations` : 'Handling category set per variation');
  PF.summaries['z-var'] = () => `${plan().units.length} variation barcodes generated`;
  PF.summaries['z-box'] = () => `${plan().boxes.length} box barcodes generated`;
  PF.summaries['z-master'] = () => `${plan().masters.length} master carton barcodes generated`;
  PF.summaries['z-summary'] = () => { const p = plan(); return `${p.units.length + p.boxes.length + p.masters.length} barcodes ready`; };
  PF.summaries['z-shipping'] = () => { const sh = shipping(); return `${sh.methodLabel} · ${sh.carrier} ${sh.service}${sh.method === 'yoovic' ? ` · ${sh.rate}` : ''}`; };
  PF.summaries['z-labels'] = () => `${plan().boxes.length} / ${plan().boxes.length} labels generated`;
  PF.summaries['z-review'] = () => 'All checks passed — ready to submit';

  // ---- Init ------------------------------------------------------------------------------------------

  PF.enterFby3 = () => {
    // Per-variation handling defaults to the selected category
    plan().units.forEach(({ unit }) => { if (!Z().perVariation[unit.id]) Z().perVariation[unit.id] = Z().handling; });
    renderAll();
    PF.ensureBarcodes();
  };

  PF.initFby3 = () => {
    if (!document.getElementById('pf-label-css')) {
      const style = document.createElement('style');
      style.id = 'pf-label-css';
      style.textContent = PF.labelCss;
      document.head.append(style);
    }
    PF.on('change', ({ path }) => {
      if (!path) return;
      if (path === 'fby3.method' || path === 'fby3.trackingMode') clearShippingErrors();
      if (path === 'fby3.method' || path === 'fby3.trackingMode' || path === 'fby3.carrier' || path === 'fby3.tracking') { renderShipping(); renderLabels(); renderReview(); PF.icons(); }
      else if (path === 'fby3.applyAll' || path === 'fby3.handling') {
        if (path === 'fby3.handling' && Z().applyAll) plan().units.forEach(({ unit }) => { Z().perVariation[unit.id] = Z().handling; });
        renderAll();
      }
    });
  };
})();
