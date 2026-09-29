/* Variations: Add Variations dialog, Page 1 overview, FBM variations table and the Variation Details panel. */
(function () {
  const PF = window.PF;
  const S = () => PF.state;

  // ---- Model -----------------------------------------------------------------

  // "50 ml (Beige)": Color goes in brackets after the other values
  PF.variationName = (attrs) => {
    const color = attrs.Color;
    const rest = Object.keys(attrs).filter((k) => k !== 'Color').map((k) => attrs[k]);
    if (!rest.length) return color || '';
    return rest.join(' / ') + (color ? ` (${color})` : '');
  };
  const slug = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]+/g, '');

  // Mock YPIN until the catalogue API issues real ones
  PF.ensureYpins = () => {
    if (!S().product.ypin) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
      S().product.ypin = 'YUS' + Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }
    S().defaultUnit.ypin = S().product.ypin;
    S().variations.forEach((v, i) => { v.ypin = `${S().product.ypin}-${String(i + 1).padStart(2, '0')}`; });
  };

  PF.newVariation = (attrs) => {
    const p = S().pricing;
    const base = S().basic.sku || 'SKU';
    return {
      id: PF.uid(), attrs, name: PF.variationName(attrs),
      sku: `${base}-${Object.values(attrs).map(slug).join('-')}`, ypin: '',
      marketPrice: p.marketPrice, price: p.unitPrice, discountType: p.discountType, discountAmount: p.discountAmount,
      qty: '', lowStock: '10', backorder: 'not_allowed', handlingTime: '1–2 Days', status: 'active',
      weight: p.weight, dimensions: p.dimensions,
      stdCost: p.stdCost, stdTime: p.stdTime, expCost: p.expCost, expTime: p.expTime,
      image: null, gallery: [], imageSource: 'variation',
    };
  };

  function combos(attributes) {
    return attributes.filter((a) => a.values.length).reduce((acc, a) => {
      const out = [];
      acc.forEach((c) => a.values.forEach((v) => out.push({ ...c, [a.name]: v })));
      return out;
    }, [{}]).filter((c) => Object.keys(c).length);
  }

  // ---- Add Variations dialog -----------------------------------------------------

  let draftAttrs = [];

  function renderDialog() {
    const catalogue = PF.options.variationAttributes || [];
    PF.$('[data-attr-picks]').innerHTML = catalogue.map((a) => {
      const on = draftAttrs.some((d) => d.name === a.name);
      return `<button type="button" class="pf-attr-pick" data-attr-pick="${PF.esc(a.name)}" aria-pressed="${on}"><i data-lucide="${on ? 'check' : 'plus'}"></i>${PF.esc(a.name)}</button>`;
    }).join('');

    PF.$('[data-attr-rows]').innerHTML = draftAttrs.map((a) => {
      const sugg = ((catalogue.find((c) => c.name === a.name) || {}).suggestions || []).filter((s) => !a.values.includes(s));
      return `<div class="pf-attr-row" data-attr-row="${PF.esc(a.name)}">
        <div class="pf-attr-row__head"><span>${PF.esc(a.name)} values</span><button type="button" class="pf-link-btn pf-link-btn--danger" data-attr-remove="${PF.esc(a.name)}">Remove</button></div>
        <div class="pf-tags">
          ${a.values.map((v) => `<span class="pf-tag">${PF.esc(v)}<button type="button" data-attr-value-remove="${PF.esc(v)}" aria-label="Remove ${PF.esc(v)}"><i data-lucide="x"></i></button></span>`).join('')}
          <input class="pf-tags__input" data-attr-input placeholder="Type a value and press Enter" aria-label="${PF.esc(a.name)} value">
        </div>
        ${sugg.length ? `<div class="pf-attr-suggest">${sugg.map((s) => `<button type="button" data-attr-suggest="${PF.esc(s)}">+ ${PF.esc(s)}</button>`).join('')}</div>` : ''}
      </div>`;
    }).join('');

    const list = combos(draftAttrs);
    PF.$('[data-attr-preview]').innerHTML = list.length
      ? `<span>${list.length} variation${list.length === 1 ? '' : 's'} will be created:</span><div class="pf-chip-list">${list.map((c) => `<span class="pf-chip">${PF.esc(PF.variationName(c))}</span>`).join('')}</div>`
      : '<span>Pick at least one attribute and add its values.</span>';
    PF.icons();
  }

  let variationsOpener = null;
  PF.openVariationsDialog = () => {
    variationsOpener = document.activeElement;
    draftAttrs = S().attributes.map((a) => ({ name: a.name, values: a.values.slice() }));
    PF.$('[data-variations-error]').hidden = true;
    renderDialog();
    PF.openModal('pf-variations-modal');
  };

  function addValue(row, value) {
    const v = value.trim();
    if (!v) return;
    const attr = draftAttrs.find((a) => a.name === row.dataset.attrRow);
    if (attr && !attr.values.some((x) => x.toLowerCase() === v.toLowerCase())) attr.values.push(v);
    renderDialog();
    const again = PF.$(`[data-attr-row="${CSS.escape(row.dataset.attrRow)}"] [data-attr-input]`);
    if (again) again.focus();
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-variations]')) { PF.openVariationsDialog(); return; }
    const pick = e.target.closest('[data-attr-pick]');
    if (pick) {
      const name = pick.dataset.attrPick;
      const i = draftAttrs.findIndex((a) => a.name === name);
      if (i >= 0) draftAttrs.splice(i, 1); else draftAttrs.push({ name, values: [] });
      renderDialog();
      return;
    }
    const rm = e.target.closest('[data-attr-remove]');
    if (rm) { draftAttrs = draftAttrs.filter((a) => a.name !== rm.dataset.attrRemove); renderDialog(); return; }
    const rmv = e.target.closest('[data-attr-value-remove]');
    if (rmv) {
      const attr = draftAttrs.find((a) => a.name === rmv.closest('[data-attr-row]').dataset.attrRow);
      attr.values = attr.values.filter((v) => v !== rmv.dataset.attrValueRemove);
      renderDialog();
      return;
    }
    const sug = e.target.closest('[data-attr-suggest]');
    if (sug) { addValue(sug.closest('[data-attr-row]'), sug.dataset.attrSuggest); return; }
    if (e.target.closest('[data-generate-variations]')) generate();
  });
  document.addEventListener('keydown', (e) => {
    if (!e.target.matches('[data-attr-input]')) return;
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addValue(e.target.closest('[data-attr-row]'), e.target.value); }
    else if (e.key === 'Backspace' && !e.target.value) {
      const attr = draftAttrs.find((a) => a.name === e.target.closest('[data-attr-row]').dataset.attrRow);
      if (attr && attr.values.length) { attr.values.pop(); renderDialog(); PF.$(`[data-attr-row="${CSS.escape(attr.name)}"] [data-attr-input]`).focus(); }
    }
  });

  async function generate() {
    const list = combos(draftAttrs);
    const err = PF.$('[data-variations-error]');
    if (!list.length) { err.textContent = 'Pick at least one attribute and add its values.'; err.hidden = false; return; }
    const key = (attrs) => JSON.stringify(Object.keys(attrs).sort().map((k) => [k, attrs[k]]));
    const existing = new Map(S().variations.map((v) => [key(v.attrs), v]));
    const removed = S().variations.filter((v) => !list.some((c) => key(c) === key(v.attrs)));
    if (removed.length && !(await PF.confirm({
      title: `Remove ${removed.length} variation${removed.length === 1 ? '' : 's'}?`,
      message: `These variations are no longer in your attribute values and will be removed, with their stock and images: ${removed.map((v) => v.name).join(', ')}.`,
      confirmLabel: 'Remove & Generate',
      danger: true,
    }))) return;
    S().attributes = draftAttrs.filter((a) => a.values.length);
    const base = S().basic.sku || 'SKU';
    const taken = new Set(S().variations.map((v) => v.sku));
    let n = 0;
    const nextSku = () => { let sku; do { n += 1; sku = `${base}-${String(n).padStart(2, '0')}`; } while (taken.has(sku)); taken.add(sku); return sku; };
    S().variations = list.map((c) => existing.get(key(c)) || { ...PF.newVariation(c), sku: nextSku() });
    PF.ensureYpins();
    PF.closeModal();
    PF.markEdited(variationsOpener);
    PF.emit('variations-changed');
    PF.emit('change', { path: 'variations' });
    PF.toast(`${S().variations.length} variation${S().variations.length === 1 ? '' : 's'} ready.`);
  }

  // ---- Page 1 overview ---------------------------------------------------------------

  function renderOverview() {
    const vars = S().variations;
    PF.$$('[data-variations-empty]').forEach((el) => { el.hidden = vars.length > 0; });
    PF.$$('[data-variations-list]').forEach((el) => {
      el.hidden = !vars.length;
      el.innerHTML = vars.length ? `<div class="pf-var-overview__top"><span><strong>${vars.length}</strong> variation${vars.length === 1 ? '' : 's'} · ${S().attributes.map((a) => PF.esc(a.name)).join(', ')}</span>
        <button type="button" class="btn pf-btn-outline btn--sm" data-open-variations><i data-lucide="square-pen"></i> Edit Variations</button></div>
        <div class="pf-chip-list">${vars.map((v) => `<span class="pf-chip"><img src="${PF.esc(PF.unitImage(v))}" alt="">${PF.esc(v.name)}</span>`).join('')}</div>` : '';
    });
  }

  // ---- FBM variations table ------------------------------------------------------------

  const filters = { q: '', Color: '', Size: '', status: '' };
  let sortDir = 0; // 0 none, 1 asc, -1 desc
  let detailsId = null;
  let detailsTab = 'media';

  function filterOptions() {
    ['Color', 'Size'].forEach((attr) => {
      const sel = PF.$(`[data-var-filter="${attr}"]`);
      if (!sel) return;
      const values = [...new Set(S().variations.map((v) => v.attrs[attr]).filter(Boolean))];
      sel.innerHTML = `<option value="">All ${attr === 'Color' ? 'Colors' : 'Sizes'}</option>` + values.map((v) => `<option${filters[attr] === v ? ' selected' : ''}>${PF.esc(v)}</option>`).join('');
      if (!values.includes(filters[attr])) filters[attr] = '';
    });
  }

  function renderTable() {
    const body = PF.$('[data-variation-rows]');
    if (!body) return;
    filterOptions();
    let rows = S().variations.filter((v) => {
      const q = filters.q.toLowerCase();
      return (!q || v.name.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q))
        && (!filters.Color || v.attrs.Color === filters.Color)
        && (!filters.Size || v.attrs.Size === filters.Size)
        && (!filters.status || v.status === filters.status);
    });
    if (sortDir) rows = rows.slice().sort((a, b) => (PF.num(a.price) - PF.num(b.price)) * sortDir);

    body.innerHTML = rows.map((v) => `<tr data-var-row="${v.id}">
        <td><label class="pf-check pf-check--bare"><input type="checkbox" data-row-check="variations" value="${v.id}" aria-label="Select ${PF.esc(v.name)}"><span class="pf-check__box" aria-hidden="true"><i data-lucide="check"></i></span></label></td>
        <td><img class="pf-var-thumb" src="${PF.esc(PF.unitImage(v))}" alt=""></td>
        <td><strong>${PF.esc(v.name)}</strong><div class="pf-var-attrs">${Object.entries(v.attrs).map(([k, val]) => `<span>${PF.esc(k)}: ${PF.esc(val)}</span>`).join('')}</div></td>
        <td>${PF.esc(v.sku)}</td>
        <td>${PF.esc(v.ypin)}</td>
        <td>${v.price === '' ? '<span class="pf-muted-cell">—</span>' : PF.num(v.price).toFixed(2)}</td>
        <td>${v.qty === '' ? '<span class="pf-muted-cell">—</span>' : PF.int(v.qty)}</td>
        <td>${statusBadge(v.status)}</td>
        <td><div class="pf-row-actions">
          <button type="button" class="pf-edit-btn" data-var-edit="${v.id}"><i data-lucide="square-pen"></i> Edit</button>
          <div class="pf-menu">
            <button type="button" class="pf-icon-btn pf-icon-btn--plain" data-menu-toggle aria-haspopup="menu" aria-expanded="false" aria-label="More actions for ${PF.esc(v.name)}"><i data-lucide="ellipsis-vertical"></i></button>
            <div class="pf-menu__list" role="menu" hidden>
              <button type="button" role="menuitem" data-var-duplicate="${v.id}"><i data-lucide="copy"></i> Duplicate</button>
              <button type="button" role="menuitem" data-var-delete="${v.id}" class="is-danger"><i data-lucide="trash-2"></i> Delete</button>
            </div>
          </div>
        </div></td>
      </tr>`).join('') || (S().variations.length ? '<tr><td colspan="9" class="pf-muted-cell">No variations match these filters.</td></tr>' : '');

    const none = PF.$('[data-variations-none]');
    if (none) none.hidden = S().variations.length > 0;
    PF.$('.pf-table--variations').closest('.pf-table-wrap').hidden = !S().variations.length;
    PF.$$('[data-count="variations"]').forEach((el) => { el.textContent = S().variations.length ? `(${S().variations.length} variation${S().variations.length === 1 ? '' : 's'})` : ''; });
    if (detailsId && !PF.findUnit(detailsId)) detailsId = null;
    if (!detailsId && S().variations.length && PF.$('[data-variation-details]').dataset.closed !== 'true') detailsId = S().variations[Math.min(1, S().variations.length - 1)].id;
    renderDetails();
    PF.icons();
  }

  PF.statusBadge = statusBadge;
  function statusBadge(status) {
    return status === 'inactive'
      ? '<span class="pf-badge pf-badge--inactive"><i data-lucide="circle-pause"></i> Inactive</span>'
      : '<span class="pf-badge pf-badge--active"><i data-lucide="circle-check"></i> Active</span>';
  }

  // ---- Variation Details panel -----------------------------------------------------------

  const TABS = [
    ['pricing', 'Pricing', 'circle-dollar-sign'], ['inventory', 'Inventory', 'boxes'], ['weight', 'Weight & Dimensions', 'ruler'],
    ['shipping', 'Shipping', 'truck'], ['media', 'Media', 'image'], ['status', 'Status', 'toggle-right'],
  ];
  const vField = (v, field, label, opts = {}) => {
    const id = `vd-${v.id}-${field}`;
    const val = v[field] === undefined || v[field] === null ? '' : v[field];
    if (opts.select) {
      return `<div class="pf-field"><label class="pf-label" for="${id}">${label}${opts.req ? ' <span class="pf-req">*</span>' : ''}</label><div class="pf-control">
        <select class="pf-input pf-select" id="${id}" data-var-field="${field}">${opts.ph ? `<option value="">${opts.ph}</option>` : ''}${opts.select.map((o) => { const value = typeof o === 'string' ? o : o.value; const text = typeof o === 'string' ? o : o.label; return `<option value="${PF.esc(value)}"${String(val) === String(value) ? ' selected' : ''}>${PF.esc(text)}</option>`; }).join('')}</select></div></div>`;
    }
    return `<div class="pf-field"><label class="pf-label" for="${id}">${label}${opts.req ? ' <span class="pf-req">*</span>' : ''}</label><div class="pf-control">
      <input class="pf-input" id="${id}" data-var-field="${field}" ${opts.number ? 'type="number" min="0" step="any" inputmode="decimal"' : 'type="text"'} value="${PF.esc(val)}" placeholder="${opts.ph || ''}"></div></div>`;
  };

  function tabContent(v) {
    const o = PF.options;
    switch (detailsTab) {
      case 'pricing': return `<div class="pf-grid pf-grid--4">${vField(v, 'marketPrice', 'Market Price ($)', { number: true, ph: '0.00' })}${vField(v, 'price', 'Unit Price ($)', { number: true, req: true, ph: '0.00' })}${vField(v, 'discountType', 'Discount Type', { select: [{ value: 'flat', label: 'Flat' }, { value: 'percent', label: 'Percent' }] })}${vField(v, 'discountAmount', 'Discount Amount', { number: true, ph: '0.00' })}</div>`;
      case 'inventory': return `<div class="pf-grid pf-grid--4">${vField(v, 'qty', 'Available Quantity', { number: true, req: true, ph: '0' })}${vField(v, 'lowStock', 'Low Stock Alert', { number: true, ph: '0' })}${vField(v, 'backorder', 'Backorder', { select: o.backorderOptions })}${vField(v, 'handlingTime', 'Handling Time', { select: o.handlingTimes })}</div>`;
      case 'weight': return `<div class="pf-grid pf-grid--2">${vField(v, 'weight', 'Weight (Ounce)', { number: true, ph: '0.00' })}${vField(v, 'dimensions', 'Dimensions (L × H × W in cm)', { ph: 'e.g. 10 × 20 × 30' })}</div>`;
      case 'shipping': return `<div class="pf-grid pf-grid--4">${vField(v, 'stdCost', 'Standard Cost ($)', { number: true, ph: '0.00' })}${vField(v, 'stdTime', 'Standard Time', { select: o.shippingTimes, ph: 'Days' })}${vField(v, 'expCost', 'Express Cost ($)', { number: true, ph: '0.00' })}${vField(v, 'expTime', 'Express Time', { select: o.shippingTimes, ph: 'Days' })}</div>`;
      case 'status': return `<div class="pf-grid pf-grid--2">${vField(v, 'status', 'Status', { select: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] })}</div>`;
      default: return `<div class="pf-var-media">
          <div><div class="pf-upload-block"><span class="pf-label pf-upload-block__label">Main Image <span class="pf-req">*</span></span><div class="pf-upload" data-upload="var:${v.id}.image" data-kind="single"></div></div></div>
          <div><div class="pf-upload-block"><span class="pf-label pf-upload-block__label">Gallery Images</span><div class="pf-upload" data-upload="var:${v.id}.gallery" data-kind="gallery" data-reorderable></div></div></div>
          <div>
            <p class="pf-label pf-upload-block__label">Image Settings</p>
            ${vField(v, 'imageSource', 'Image Source', { select: [{ value: 'variation', label: 'Variation Specific' }, { value: 'product', label: 'Same as Product' }] })}
            <label class="pf-toggle" style="margin-top:12px"><input type="checkbox" role="switch" data-same-images${S().variations.every((x) => x.imageSource === 'shared') ? ' checked' : ''}><span class="pf-toggle__track" aria-hidden="true"></span><span>Use Same Images for All Variations</span></label>
            <div class="pf-note"><i data-lucide="info"></i><span>Each variation has its own main image and gallery. You can also copy images from another variation.</span></div>
          </div>
        </div>`;
    }
  }

  function renderDetails() {
    const panel = PF.$('[data-variation-details]');
    if (!panel) return;
    const v = detailsId && PF.findUnit(detailsId);
    panel.hidden = !v;
    if (!v) { panel.innerHTML = ''; return; }
    panel.innerHTML = `<div class="pf-var-details__head">
        <img class="pf-var-thumb" src="${PF.esc(PF.unitImage(v))}" alt="">
        <div><h4>Variation Details – ${PF.esc(v.name)}</h4><p>SKU: ${PF.esc(v.sku)}&nbsp;&nbsp;|&nbsp;&nbsp;YPIN: ${PF.esc(v.ypin)}</p></div>
        <button type="button" class="pf-icon-btn pf-var-details__close" data-var-details-close aria-label="Close variation details"><i data-lucide="x"></i></button>
      </div>
      <div class="pf-tabs" role="tablist">${TABS.map(([id, label, icon]) => `<button type="button" class="pf-tab${detailsTab === id ? ' is-active' : ''}" role="tab" aria-selected="${detailsTab === id}" data-var-tab="${id}"><i data-lucide="${icon}"></i> ${label}</button>`).join('')}</div>
      <div role="tabpanel" data-var-id="${v.id}">${tabContent(v)}</div>`;
    PF.renderUploads();
  }

  // ---- Table & panel interactions ----------------------------------------------------------

  const rerenderAll = () => { PF.emit('variations-changed'); PF.emit('change', { path: 'variations' }); };

  PF.confirmDelete = (names) => PF.confirm({
    title: names.length === 1 ? `Delete "${names[0]}"?` : `Delete ${names.length} variations?`,
    message: names.length === 1
      ? 'This variation and its stock, pricing and images will be removed. This cannot be undone.'
      : `${names.join(', ')} will be removed with their stock, pricing and images. This cannot be undone.`,
    confirmLabel: 'Delete',
    danger: true,
  });

  document.addEventListener('click', async (e) => {
    const section = e.target.closest && e.target.closest('.pf-section');
    const edit = e.target.closest('[data-var-edit]');
    if (edit) {
      detailsId = edit.dataset.varEdit;
      PF.$('[data-variation-details]').dataset.closed = 'false';
      renderDetails();
      PF.icons();
      PF.$('[data-variation-details]').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    if (e.target.closest('[data-var-details-close]')) {
      detailsId = null;
      PF.$('[data-variation-details]').dataset.closed = 'true';
      renderDetails();
      return;
    }
    const tab = e.target.closest('[data-var-tab]');
    if (tab) { detailsTab = tab.dataset.varTab; renderDetails(); PF.icons(); return; }
    const dup = e.target.closest('[data-var-duplicate]');
    if (dup) {
      const src = PF.findUnit(dup.dataset.varDuplicate);
      const copy = { ...JSON.parse(JSON.stringify(src)), id: PF.uid(), sku: `${src.sku}-COPY`, name: `${src.name} (Copy)` };
      S().variations.splice(S().variations.indexOf(src) + 1, 0, copy);
      PF.markEdited(section);
      PF.ensureYpins();
      rerenderAll();
      return;
    }
    const del = e.target.closest('[data-var-delete]');
    if (del) {
      const v = PF.findUnit(del.dataset.varDelete);
      if (v && (await PF.confirmDelete([v.name]))) {
        S().variations = S().variations.filter((x) => x !== v);
        PF.markEdited(section);
        PF.ensureYpins();
        rerenderAll();
      }
      return;
    }
    const bulk = e.target.closest('[data-bulk-action]');
    if (bulk) {
      const ids = PF.$$('[data-row-check="variations"]:checked').map((c) => c.value);
      if (!ids.length) { PF.toast('Select at least one variation first.', 'error'); return; }
      PF.markEdited(section);
      if (bulk.dataset.bulkAction === 'delete') {
        if (!(await PF.confirmDelete(S().variations.filter((v) => ids.includes(v.id)).map((v) => v.name)))) return;
        S().variations = S().variations.filter((v) => !ids.includes(v.id));
        PF.ensureYpins();
      } else {
        S().variations.forEach((v) => { if (ids.includes(v.id)) v.status = bulk.dataset.bulkAction; });
      }
      rerenderAll();
      PF.toast('Bulk action applied.');
      return;
    }
    const sort = e.target.closest('[data-sort="price"]');
    if (sort) { sortDir = sortDir === 1 ? -1 : sortDir === -1 ? 0 : 1; renderTable(); }
  });

  document.addEventListener('input', (e) => {
    if (e.target.matches('[data-var-filter="q"]')) { filters.q = e.target.value; renderTable(); }
  });
  document.addEventListener('change', (e) => {
    const f = e.target.closest('[data-var-filter]');
    if (f && f.tagName === 'SELECT') { filters[f.dataset.varFilter] = f.value; renderTable(); return; }
    const vf = e.target.closest('select[data-var-field]');
    if (vf) {
      const v = PF.findUnit(vf.closest('[data-var-id]').dataset.varId);
      v[vf.dataset.varField] = vf.value;
      if (vf.dataset.varField === 'imageSource' && vf.value === 'product') { v.image = null; v.gallery = []; }
      rerenderAll();
      return;
    }
    if (e.target.matches('[data-same-images]')) {
      const v = PF.findUnit(e.target.closest('[data-var-id]').dataset.varId);
      if (e.target.checked) {
        S().variations.forEach((x) => { x.image = v.image; x.gallery = v.gallery.slice(); x.imageSource = 'shared'; });
        PF.toast(`Copied ${v.name}'s images to all variations.`);
      } else {
        S().variations.forEach((x) => { if (x.imageSource === 'shared') x.imageSource = 'variation'; });
      }
      rerenderAll();
    }
  });
  // Typing in a number/text field inside the panel updates state without re-rendering (keeps focus)
  document.addEventListener('input', (e) => {
    const vf = e.target.closest('[data-var-field]');
    if (!vf || vf.tagName === 'SELECT') return;
    const v = PF.findUnit(vf.closest('[data-var-id]').dataset.varId);
    v[vf.dataset.varField] = vf.value;
    PF.emit('change', { path: `var:${v.id}.${vf.dataset.varField}`, source: vf });
    PF.emit('variations-soft-changed', v.id);
    PF.emit('units-soft-changed', v.id);
  });

  // Select-all checkboxes for any table
  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-check-all]')) {
      const group = e.target.dataset.checkAll;
      PF.$$(`[data-row-check="${group}"]`).forEach((c) => { c.checked = e.target.checked; c.closest('tr').classList.toggle('is-selected', c.checked); });
    } else if (e.target.matches('[data-row-check]')) {
      e.target.closest('tr').classList.toggle('is-selected', e.target.checked);
    }
  });

  // Dropdown menus (Bulk Actions, row kebab)
  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-menu-toggle]');
    PF.$$('.pf-menu__list').forEach((list) => {
      const own = toggle && toggle.parentElement.contains(list);
      if (!own || !list.hidden) { list.hidden = true; list.previousElementSibling.setAttribute('aria-expanded', 'false'); }
      else { list.hidden = false; toggle.setAttribute('aria-expanded', 'true'); }
    });
  });

  // ---- Validation & summaries ---------------------------------------------------------------

  PF.validators['m-variations'] = () => {
    const missing = S().variations.filter((v) => v.price === '' || v.price === undefined || !(PF.num(v.price) > 0));
    return missing.length ? [{ msg: `Set a unit price for: ${missing.map((v) => v.name).join(', ')}.` }] : [];
  };
  PF.summaries['b-variations'] = () => (S().variations.length ? `${S().variations.length} variations · ${S().variations.map((v) => v.name).join(', ')}` : 'No variations — sold as a single product');
  PF.summaries['m-variations'] = () => {
    const active = S().variations.filter((v) => v.status !== 'inactive').length;
    return S().variations.length ? `${S().variations.length} variations · ${active} active` : 'No variations';
  };

  PF.initVariations = () => {
    PF.ensureYpins();
    const all = () => { renderOverview(); renderTable(); };
    all();
    PF.on('variations-changed', all);
    // Typing in the details panel only refreshes that row's price and stock cells, so focus stays put
    PF.on('variations-soft-changed', (id) => updateRowCells(id));
    PF.on('change', ({ path }) => {
      if (path === 'media.thumbnail' || path === 'basic.nameEn') renderOverview();
      if (path && path.startsWith('var:') && /\.(image|gallery)$/.test(path)) { renderOverview(); renderTable(); }
    });
  };

  function updateRowCells(id) {
    const v = PF.findUnit(id);
    const row = v && PF.$(`[data-var-row="${CSS.escape(id)}"]`);
    if (!row) return;
    row.children[5].innerHTML = v.price === '' ? '<span class="pf-muted-cell">—</span>' : PF.num(v.price).toFixed(2);
    row.children[6].innerHTML = v.qty === '' ? '<span class="pf-muted-cell">—</span>' : String(PF.int(v.qty));
  }
})();
