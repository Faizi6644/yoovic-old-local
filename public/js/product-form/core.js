/* Add New Product flow — shared state, helpers and dialogs. Everything hangs off window.PF. */
(function () {
  const PF = (window.PF = window.PF || {});

  const readJson = (id) => {
    const el = document.getElementById(id);
    try { return el ? JSON.parse(el.textContent) : null; } catch (e) { return null; }
  };
  PF.options = readJson('pf-options') || {};
  PF.initialDraft = readJson('pf-draft');

  // ---- State ----------------------------------------------------------------

  PF.defaultState = () => ({
    step: 'basic',
    fulfillment: 'fbm',
    basic: {
      nameEn: '', nameAe: '', descEn: '', descAe: '', shortEn: '', shortAe: '',
      category: '', subCategory: '', subSubCategory: '', brand: '', productType: 'physical', sku: '', unit: '', tags: [],
    },
    pricing: {
      marketPrice: '', unitPrice: '', minQty: '1', discountType: 'flat', discountAmount: '', taxAmount: '',
      taxCalc: 'include', refundable: 'yes', weight: '', dimensions: '',
      stdCost: '', stdTime: '', expCost: '', expTime: '', multiplyQty: false,
    },
    media: { thumbnail: null, gallery: [], videoUrl: '', metaTitle: '', metaDesc: '', metaImage: null },
    attributes: [],          // [{ name, values: [] }] chosen in the Add Variations dialog
    variations: [],          // generated variations (see PF.newVariation)
    product: { ypin: '' },
    defaultUnit: { id: 'default', sku: '', ypin: '', qty: '', lowStock: '10', backorder: 'not_allowed', handlingTime: '1–2 Days', status: 'active' },
    fbm: { trackInventory: true },
    fby: {
      selected: {}, sendQty: {},
      packingMethod: 'same', boxes: '', itemsPerBox: '', perBox: [],
      variationPacking: 'multiple',
      sameDims: true, length: '', width: '', height: '', weight: '', dimUnit: 'cm', weightUnit: 'kg', boxDims: [],
      packagingType: 'Carton', unitsPerCase: '', individualPackaging: 'yes',
      useMaster: 'yes', masterCount: '', boxesPerMaster: '', mLength: '', mWidth: '', mHeight: '', mWeight: '',
      warehouse: (PF.options.warehouses && PF.options.warehouses[0] && PF.options.warehouses[0].id) || '',
      tracking: '', arrivalDate: '', arrivalWindow: '',
      validation: null,
    },
    progress: { basic: {}, fbm: {}, fby: {} },
  });

  // Deep-merge saved data over defaults so new fields always exist
  function merge(base, extra) {
    if (extra === undefined || extra === null) return base;
    if (typeof extra !== 'object' || Array.isArray(extra)) return extra;
    const out = Array.isArray(base) ? [] : { ...base };
    Object.keys(extra).forEach((k) => {
      out[k] = base && typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k])
        ? merge(base[k], extra[k]) : extra[k];
    });
    return out;
  }
  PF.state = merge(PF.defaultState(), PF.initialDraft && PF.initialDraft.data);
  PF.draftId = PF.initialDraft ? PF.initialDraft.id : null;

  // Paths: "basic.nameEn" or "var:<variationId>.image" (variation fields by id, stable across deletes)
  function resolve(path) {
    const parts = path.split('.');
    let obj = PF.state;
    if (parts[0].startsWith('var:')) {
      const id = parts.shift().slice(4);
      obj = PF.findUnit(id);
      if (!obj) return { obj: null, key: null };
    }
    const key = parts.pop();
    for (const p of parts) {
      if (obj[p] === undefined || obj[p] === null) obj[p] = {};
      obj = obj[p];
    }
    return { obj, key };
  }
  PF.get = (path) => { const { obj, key } = resolve(path); return obj ? obj[key] : undefined; };
  PF.set = (path, value, source) => {
    const { obj, key } = resolve(path);
    if (!obj) return;
    obj[key] = value;
    PF.emit('change', { path, value, source });
  };

  // ---- Events -----------------------------------------------------------------

  const listeners = {};
  PF.on = (name, fn) => { (listeners[name] = listeners[name] || []).push(fn); };
  PF.emit = (name, detail) => { (listeners[name] || []).forEach((fn) => fn(detail)); };

  // ---- Units: the variations, or the product itself when it has none ---------

  PF.units = () => (PF.state.variations.length ? PF.state.variations : [PF.state.defaultUnit]);
  PF.findUnit = (id) => (id === 'default' ? PF.state.defaultUnit : PF.state.variations.find((v) => v.id === id));
  PF.unitName = (u) => (u.id === 'default' ? (PF.state.basic.nameEn || 'Default') : u.name);
  PF.unitImage = (u) => u.image || PF.state.media.thumbnail || PF.placeholderImg;
  PF.placeholderImg = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#e6ecf7"/><path d="M11 27l6-7 5 5 3-3 4 5z" fill="#9fb3d8"/><circle cx="25" cy="15" r="3" fill="#9fb3d8"/></svg>');

  // ---- Helpers ----------------------------------------------------------------

  PF.$ = (sel, root = document) => root.querySelector(sel);
  PF.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  PF.esc = (s) => String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  PF.num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  PF.int = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
  PF.money = (v) => '$' + PF.num(v).toFixed(2);
  PF.uid = () => Math.random().toString(36).slice(2, 10);
  PF.icons = () => { if (window.lucide) window.lucide.createIcons(); };
  PF.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  PF.categoryPath = () => {
    const b = PF.state.basic;
    const cat = (PF.options.categories || []).find((c) => c.id === b.category);
    const sub = cat && cat.children.find((c) => c.id === b.subCategory);
    const leaf = sub && sub.children.find((c) => c.id === b.subSubCategory);
    return [cat, sub, leaf].filter(Boolean).map((c) => c.name);
  };
  PF.brandName = () => ((PF.options.brands || []).find((x) => x.id === PF.state.basic.brand) || {}).name || '';

  // Keeps only simple formatting tags; strips scripts, events and unsafe links
  const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'H1', 'H2', 'P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'A', 'PRE', 'CODE', 'SPAN']);
  PF.sanitize = (html) => {
    const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) return;
        if (child.nodeType !== 1 || !ALLOWED.has(child.tagName)) {
          if (child.nodeType === 1 && !['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT'].includes(child.tagName)) {
            walk(child);
            child.replaceWith(...child.childNodes);
          } else {
            child.remove();
          }
          return;
        }
        Array.from(child.attributes).forEach((a) => {
          const keep = child.tagName === 'A' && a.name === 'href' && /^(https?:|mailto:)/i.test(a.value.trim());
          if (!keep) child.removeAttribute(a.name);
        });
        if (child.tagName === 'A') { child.setAttribute('target', '_blank'); child.setAttribute('rel', 'noopener noreferrer'); }
        walk(child);
      });
    };
    const root = doc.body.firstChild;
    walk(root);
    return root.innerHTML;
  };
  PF.textOf = (html) => { const d = document.createElement('div'); d.innerHTML = PF.sanitize(html); return d.textContent.trim(); };

  // ---- Toasts -------------------------------------------------------------------

  PF.toast = (message, kind) => {
    const box = PF.$('.pf-toasts');
    if (!box) return;
    const t = document.createElement('div');
    t.className = 'pf-toast' + (kind === 'error' ? ' is-error' : '');
    t.innerHTML = `<i data-lucide="${kind === 'error' ? 'circle-alert' : 'circle-check'}"></i><span></span>`;
    t.querySelector('span').textContent = message;
    box.append(t);
    PF.icons();
    setTimeout(() => t.remove(), 3500);
  };

  // ---- Dialogs ------------------------------------------------------------------

  let openModalEl = null;
  let returnFocus = null;
  PF.openModal = (id) => {
    const m = document.getElementById(id);
    if (!m) return;
    returnFocus = document.activeElement;
    m.hidden = false;
    openModalEl = m;
    PF.icons();
    const first = m.querySelector('input, select, button:not([data-modal-close]), [tabindex="0"]') || m.querySelector('button');
    if (first) first.focus();
  };
  // The element that opened the current dialog (used to tell which section an edit belongs to)
  PF.modalOpener = () => returnFocus;
  PF.closeModal = () => {
    if (!openModalEl) return;
    openModalEl.hidden = true;
    openModalEl = null;
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
  };
  document.addEventListener('click', (e) => {
    if (dialogResolve) return;
    if (e.target.closest('[data-modal-close]') || (openModalEl && e.target === openModalEl)) PF.closeModal();
  });

  // ---- Confirm / prompt dialog (styled replacements for window.confirm / window.prompt) ----
  // Stacks above other dialogs. Resolves to true/false (confirm) or the entered text / null (prompt).

  let dialogResolve = null;
  let dialogValidate = null;
  let dialogReturnFocus = null;

  function openDialog({ title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false, icon, input, validate }) {
    const box = document.getElementById('pf-dialog');
    if (!box) return Promise.resolve(input ? null : false);
    if (dialogResolve) dialogResolve(input ? null : false);
    dialogReturnFocus = document.activeElement;
    box.querySelector('[data-dialog-title]').textContent = title;
    box.querySelector('[data-dialog-message]').textContent = message || '';
    box.querySelector('[data-dialog-icon]').innerHTML = `<i data-lucide="${icon || (danger ? 'triangle-alert' : input ? 'link' : 'circle-help')}"></i>`;
    box.querySelector('[data-dialog-icon]').classList.toggle('is-danger', danger);
    const ok = box.querySelector('[data-dialog-ok]');
    ok.textContent = confirmLabel;
    ok.classList.toggle('pf-btn-danger', danger);
    ok.classList.toggle('btn--primary', !danger);
    box.querySelector('[data-dialog-cancel]').textContent = cancelLabel;
    const field = box.querySelector('[data-dialog-field]');
    const inputEl = box.querySelector('[data-dialog-input]');
    const err = box.querySelector('[data-dialog-error]');
    field.hidden = !input;
    err.hidden = true;
    inputEl.classList.remove('is-invalid');
    if (input) {
      box.querySelector('[data-dialog-label]').textContent = input.label || '';
      inputEl.type = input.type || 'text';
      inputEl.placeholder = input.placeholder || '';
      inputEl.value = input.value || '';
    }
    dialogValidate = validate || null;
    box.hidden = false;
    PF.icons();
    (input ? inputEl : ok).focus();
    if (input) inputEl.select();
    return new Promise((resolve) => {
      dialogResolve = (value) => {
        box.hidden = true;
        dialogResolve = null;
        dialogValidate = null;
        if (dialogReturnFocus && document.contains(dialogReturnFocus)) dialogReturnFocus.focus();
        resolve(value);
      };
      dialogResolve.isPrompt = Boolean(input);
    });
  }

  function submitDialog() {
    if (!dialogResolve) return;
    if (!dialogResolve.isPrompt) { dialogResolve(true); return; }
    const box = document.getElementById('pf-dialog');
    const inputEl = box.querySelector('[data-dialog-input]');
    const value = inputEl.value.trim();
    const message = dialogValidate ? dialogValidate(value) : '';
    if (message) {
      const err = box.querySelector('[data-dialog-error]');
      err.textContent = message;
      err.hidden = false;
      inputEl.classList.add('is-invalid');
      inputEl.focus();
      return;
    }
    dialogResolve(value);
  }
  const cancelDialog = () => { if (dialogResolve) dialogResolve(dialogResolve.isPrompt ? null : false); };

  PF.confirm = (opts) => openDialog(opts);
  PF.prompt = (opts) => openDialog(opts);

  document.addEventListener('click', (e) => {
    if (!dialogResolve) return;
    if (e.target.closest('[data-dialog-ok]')) submitDialog();
    else if (e.target.closest('[data-dialog-cancel]') || e.target.id === 'pf-dialog') cancelDialog();
  });
  document.addEventListener('input', (e) => {
    if (!e.target.matches('[data-dialog-input]')) return;
    e.target.classList.remove('is-invalid');
    document.querySelector('[data-dialog-error]').hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (!dialogResolve) return;
    if (e.key === 'Escape') { e.preventDefault(); cancelDialog(); return; }
    if (e.key === 'Enter' && e.target.matches('[data-dialog-input]')) { e.preventDefault(); submitDialog(); return; }
    if (e.key === 'Tab') {
      const f = PF.$$('#pf-dialog input:not([disabled]), #pf-dialog button').filter((el) => el.offsetParent !== null);
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      else if (!f.includes(document.activeElement)) { e.preventDefault(); f[0].focus(); }
    }
  });
  document.addEventListener('keydown', (e) => {
    if (!openModalEl || dialogResolve) return; // the confirm/prompt dialog handles its own keys
    if (e.key === 'Escape') { PF.closeModal(); return; }
    if (e.key !== 'Tab') return;
    const f = PF.$$('button:not([disabled]), input:not([disabled]), select, [tabindex="0"]', openModalEl).filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });

  // ---- Form binding: every [name] input mirrors its state path ------------------

  const fieldValue = (el) => (el.type === 'checkbox' ? el.checked : el.value);

  // Writes a state value into every input bound to that path (on all pages)
  PF.fill = (path) => {
    const value = PF.get(path);
    PF.$$(`[name="${CSS.escape(path)}"]`).forEach((el) => {
      if (el.type === 'radio') el.checked = el.value === String(value);
      else if (el.type === 'checkbox') el.checked = Boolean(value);
      else if (el.tagName === 'SELECT' || document.activeElement !== el) el.value = value === undefined || value === null ? '' : value;
      if (el.hasAttribute('data-counter')) PF.updateCounter(el);
    });
  };
  PF.fillAll = () => {
    const paths = new Set(PF.$$('.pf-page [name]').map((el) => el.name));
    paths.forEach((p) => PF.fill(p));
  };
  PF.updateCounter = (el) => {
    const c = document.querySelector(`[data-counter-for="${el.id}"]`);
    if (c) c.textContent = `${el.value.length}/${el.maxLength}`;
  };

  document.addEventListener('input', onFieldEvent);
  document.addEventListener('change', onFieldEvent);
  // Editing any field (including table cells) clears its error highlight
  document.addEventListener('input', (e) => { if (e.target.closest && e.target.closest('.pf-page')) PF.clearError(e.target); });
  document.addEventListener('change', (e) => { if (e.target.closest && e.target.closest('.pf-page')) PF.clearError(e.target); });
  function onFieldEvent(e) {
    const el = e.target;
    if (!el.name || !el.closest('.pf-page')) return;
    // Money fields (placeholder 0.00) show two decimals once the user leaves them
    if (e.type === 'change' && el.placeholder === '0.00' && el.value !== '' && Number.isFinite(Number(el.value))) {
      el.value = Number(el.value).toFixed(2);
    }
    if (el.type === 'radio' && !el.checked) return;
    if (e.type === 'input' && (el.type === 'radio' || el.type === 'checkbox' || el.tagName === 'SELECT')) return;
    PF.set(el.name, fieldValue(el), el);
    if (el.hasAttribute('data-counter')) PF.updateCounter(el);
    PF.clearError(el);
    // Keep the other copies (e.g. Page 1 pricing and FBM pricing) in sync
    PF.$$(`[name="${CSS.escape(el.name)}"]`).forEach((other) => {
      if (other === el) return;
      if (other.type === 'radio') other.checked = other.value === el.value && el.checked;
      else if (other.type === 'checkbox') other.checked = el.checked;
      else other.value = el.value;
      if (other.hasAttribute('data-counter')) PF.updateCounter(other);
    });
  }

  // ---- Field errors -------------------------------------------------------------

  PF.showError = (el, message) => {
    const field = el.closest('.pf-field, .pf-upload-block') || el.parentElement;
    if (field) {
      field.classList.add('pf-invalid');
      const msg = field.querySelector(':scope > .pf-error');
      if (msg) { msg.textContent = message; msg.hidden = false; }
    }
    if (el.classList && el.classList.contains('pf-input') && !el.closest('.pf-field')) el.classList.add('is-invalid');
  };
  PF.clearError = (el) => {
    const field = el.closest && el.closest('.pf-invalid');
    if (field) {
      field.classList.remove('pf-invalid');
      const msg = field.querySelector(':scope > .pf-error');
      if (msg) msg.hidden = true;
    }
    if (el.classList) el.classList.remove('is-invalid');
  };
})();
