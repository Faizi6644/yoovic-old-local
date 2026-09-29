/* FBM page: product summary, Seller Inventory table, Bulk Edit and per-row inventory dialog. */
(function () {
  const PF = window.PF;
  const S = () => PF.state;

  // ---- Product summary (also used on the FBY page) ------------------------------------

  PF.renderProductSummary = () => {
    const b = S().basic;
    const path = PF.categoryPath();
    const variations = S().variations.length;
    const img = S().media.thumbnail || PF.placeholderImg;
    const type = b.productType === 'digital' ? 'Digital' : 'Physical';
    PF.$$('[data-product-summary]').forEach((box) => {
      const fby = box.dataset.productSummary === 'fby';
      box.innerHTML = `
        <img class="pf-product-summary__img" src="${PF.esc(img)}" alt="">
        <div>
          <p class="pf-product-summary__name">${PF.esc(b.nameEn || 'Untitled product')}</p>
          <dl>
            <dt>Category:</dt><dd>${path.length ? path.map(PF.esc).join('<span class="pf-cat-sep">&gt;</span>') : '—'}</dd>
            <dt>Brand:</dt><dd>${PF.esc(PF.brandName() || '—')}</dd>
            <dt>Product Type:</dt><dd>${type}</dd>
          </dl>
        </div>
        <dl>
          <dt>SKU${fby ? '' : ' (Default)'}:</dt><dd>${PF.esc(b.sku || '—')}</dd>
          <dt>YPIN:</dt><dd>${PF.esc(S().product.ypin)}</dd>
          <dt>Total Variations:</dt><dd>${variations || 1}</dd>
          ${fby ? '' : '<dt>Fulfillment:</dt><dd><span class="pf-badge pf-badge--fbm"><i data-lucide="circle-check"></i> FBM (Seller Fulfilled)</span></dd>'}
        </dl>`;
    });
    PF.icons();
  };

  // ---- Seller Inventory table -------------------------------------------------------------

  const cellInput = (u, field, attrs) => `<input class="pf-input" data-unit="${u.id}" data-unit-field="${field}" value="${PF.esc(u[field])}" ${attrs}>`;
  const cellSelect = (u, field, opts) => `<select class="pf-input pf-select" data-unit="${u.id}" data-unit-field="${field}" aria-label="${field === 'backorder' ? 'Backorder' : 'Handling time'} for ${PF.esc(PF.unitName(u))}">
      ${opts.map((o) => { const v = typeof o === 'string' ? o : o.value; const l = typeof o === 'string' ? o : o.label; return `<option value="${PF.esc(v)}"${String(u[field]) === String(v) ? ' selected' : ''}>${PF.esc(l)}</option>`; }).join('')}</select>`;

  function renderInventory() {
    const body = PF.$('[data-inventory-rows]');
    if (!body) return;
    const tracking = S().fbm.trackInventory;
    const units = PF.units();
    body.innerHTML = units.map((u) => {
      const name = PF.unitName(u);
      return `<tr data-unit-row="${u.id}">
        <td><label class="pf-check pf-check--bare"><input type="checkbox" data-row-check="inventory" value="${u.id}" aria-label="Select ${PF.esc(name)}"><span class="pf-check__box" aria-hidden="true"><i data-lucide="check"></i></span></label></td>
        <td><div class="pf-cell-var"><img src="${PF.esc(PF.unitImage(u))}" alt=""><div>${PF.esc(u.id === 'default' ? name : u.attrs.Size || name)}<small>${PF.esc(u.sku || S().basic.sku)}</small></div></div></td>
        <td>${cellInput(u, 'sku', `aria-label="SKU for ${PF.esc(name)}" placeholder="SKU"`)}</td>
        <td><input class="pf-input" value="${PF.esc(u.ypin)}" readonly tabindex="-1" aria-label="YPIN for ${PF.esc(name)}"></td>
        <td>${cellInput(u, 'qty', `type="number" min="0" step="1" inputmode="numeric" placeholder="0" aria-label="Available quantity for ${PF.esc(name)}"${tracking ? '' : ' disabled'}`)}</td>
        <td>${cellInput(u, 'lowStock', `type="number" min="0" step="1" inputmode="numeric" placeholder="0" aria-label="Low stock alert for ${PF.esc(name)}"${tracking ? '' : ' disabled'}`)}</td>
        <td>${cellSelect(u, 'backorder', PF.options.backorderOptions)}</td>
        <td>${PF.statusBadge(u.status)}</td>
        <td>${cellSelect(u, 'handlingTime', PF.options.handlingTimes)}</td>
        <td><div class="pf-row-actions">
          <button type="button" class="pf-icon-btn" data-unit-edit="${u.id}" aria-label="Edit ${PF.esc(name)}"><i data-lucide="square-pen"></i></button>
          <button type="button" class="pf-icon-btn pf-icon-btn--danger" data-unit-delete="${u.id}" aria-label="Delete ${PF.esc(name)}"${u.id === 'default' ? ' disabled' : ''}><i data-lucide="trash-2"></i></button>
        </div></td>
      </tr>`;
    }).join('');
    PF.icons();
  }
  PF.renderInventory = renderInventory;

  // Unit fields typed in the table
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-unit-field]');
    if (!el || el.tagName === 'SELECT') return;
    const u = PF.findUnit(el.dataset.unit);
    u[el.dataset.unitField] = el.value;
    el.classList.remove('is-invalid');
    PF.emit('change', { path: `var:${u.id}.${el.dataset.unitField}`, source: el });
    PF.emit('units-soft-changed', u.id);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('select[data-unit-field]');
    if (!el) return;
    PF.findUnit(el.dataset.unit)[el.dataset.unitField] = el.value;
    PF.emit('change', { path: `var:${el.dataset.unit}.${el.dataset.unitField}`, source: el });
  });

  // ---- Edit / delete / bulk edit ---------------------------------------------------------------

  let editingId = null;
  document.addEventListener('click', async (e) => {
    const edit = e.target.closest('[data-unit-edit]');
    if (edit) {
      editingId = edit.dataset.unitEdit;
      const u = PF.findUnit(editingId);
      PF.$('[data-inventory-hint]').textContent = `${PF.unitName(u)} · SKU ${u.sku || S().basic.sku || '—'}`;
      PF.$$('[data-inv]').forEach((f) => { f.value = u[f.dataset.inv] === undefined ? '' : u[f.dataset.inv]; });
      PF.openModal('pf-inventory-modal');
      return;
    }
    if (e.target.closest('[data-inventory-save]') && editingId) {
      const u = PF.findUnit(editingId);
      const qty = PF.$('[data-inv="qty"]');
      if (qty.value === '' || Number(qty.value) < 0) { qty.classList.add('is-invalid'); qty.focus(); return; }
      PF.markEdited(PF.modalOpener());
      PF.$('[data-inv]').forEach((f) => { u[f.dataset.inv] = f.value; });
      PF.closeModal();
      PF.emit('variations-changed');
      PF.emit('change', { path: `var:${u.id}` });
      return;
    }
    const del = e.target.closest('[data-unit-delete]');
    if (del) {
      const u = PF.findUnit(del.dataset.unitDelete);
      if (u && u.id !== 'default' && (await PF.confirmDelete([u.name]))) {
        PF.markEdited(del);
        S().variations = S().variations.filter((v) => v !== u);
        PF.ensureYpins();
        PF.emit('variations-changed');
        PF.emit('change', { path: 'variations' });
      }
      return;
    }
    if (e.target.closest('[data-bulk-edit]')) {
      PF.$$('[data-bulk]').forEach((f) => { f.value = ''; });
      PF.$('[data-bulk-error]').hidden = true;
      const n = PF.$$('[data-row-check="inventory"]:checked').length;
      PF.$('[data-bulk-hint]').textContent = n
        ? `Editing ${n} selected variation${n === 1 ? '' : 's'}. Leave a field empty to keep its current value.`
        : 'No rows selected — changes apply to all variations. Leave a field empty to keep its current value.';
      PF.openModal('pf-bulk-modal');
      return;
    }
    if (e.target.closest('[data-bulk-apply]')) {
      const checked = PF.$$('[data-row-check="inventory"]:checked').map((c) => c.value);
      const targets = checked.length ? checked.map(PF.findUnit) : PF.units();
      const values = Object.fromEntries(PF.$$('[data-bulk]').filter((f) => f.value !== '').map((f) => [f.dataset.bulk, f.value]));
      if (!Object.keys(values).length) {
        const err = PF.$('[data-bulk-error]');
        err.textContent = 'Enter at least one value to apply.';
        err.hidden = false;
        return;
      }
      PF.markEdited(PF.modalOpener());
      targets.forEach((u) => Object.assign(u, values));
      PF.closeModal();
      PF.emit('variations-changed');
      PF.emit('change', { path: 'variations' });
      PF.toast(`Updated ${targets.length} variation${targets.length === 1 ? '' : 's'}.`);
    }
  });

  // ---- Validation & summaries ----------------------------------------------------------------

  PF.validators['m-inventory'] = () => {
    const errors = [];
    PF.units().forEach((u) => {
      const row = PF.$(`[data-unit-row="${CSS.escape(u.id)}"]`);
      const cell = (f) => row && row.querySelector(`[data-unit-field="${f}"]`);
      if (!String(u.sku || '').trim()) errors.push({ el: cell('sku'), msg: 'SKU is required for every variation.', general: true });
      if (S().fbm.trackInventory && (u.qty === '' || u.qty === undefined || Number(u.qty) < 0)) {
        errors.push({ el: cell('qty'), msg: 'Enter the available quantity for every variation.', general: true });
      }
    });
    return errors;
  };
  const pricingSummary = () => {
    const p = S().pricing;
    return `Unit ${PF.money(p.unitPrice)} · Market ${PF.money(p.marketPrice)} · Tax ${PF.num(p.taxAmount)}% · Standard shipping ${PF.money(p.stdCost)}`;
  };
  PF.summaries['b-pricing'] = PF.summaries['m-pricing'] = pricingSummary;
  PF.summaries['m-inventory'] = () => {
    const units = PF.units();
    const total = units.reduce((a, u) => a + PF.int(u.qty), 0);
    return `${units.length} variation${units.length === 1 ? '' : 's'} · ${total} units in stock${S().fbm.trackInventory ? '' : ' · tracking off'}`;
  };

  PF.initFbm = () => {
    renderInventory();
    PF.renderProductSummary();
    PF.on('variations-changed', () => { renderInventory(); PF.renderProductSummary(); });
    PF.on('change', ({ path, source }) => {
      if (path === 'fbm.trackInventory') renderInventory();
      if (['basic.nameEn', 'basic.sku', 'basic.brand', 'basic.category', 'basic.subCategory', 'basic.subSubCategory', 'basic.productType', 'media.thumbnail'].includes(path)) {
        PF.renderProductSummary();
        if (path === 'media.thumbnail' || path === 'basic.nameEn' || path === 'basic.sku') renderInventory();
      }
      // Detail-panel edits of stock fields show up in the table (the row being typed in is left alone)
      if (path && path.startsWith('var:') && source && !source.closest('[data-inventory-rows]') && /\.(qty|lowStock|sku)$/.test(path)) {
        const [, id, field] = path.match(/^var:([^.]+)\.(\w+)$/) || [];
        const input = id && PF.$(`[data-unit="${CSS.escape(id)}"][data-unit-field="${field}"]`);
        if (input) input.value = PF.findUnit(id)[field];
      }
    });
  };
})();
