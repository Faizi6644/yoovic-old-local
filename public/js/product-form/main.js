/* Boots the Add New Product flow: step routing, dependent dropdowns, tags, language tabs,
   Save Draft (MySQL via PF.api), Preview and unsaved-change tracking. */
(function () {
  const PF = window.PF;
  const S = () => PF.state;

  // ---- Steps: basic -> fbm | fby -> page3 (FBM) / fby3 -> fby-done (FBY) ------------------

  const STEPS = ['basic', 'fbm', 'fby', 'fby3', 'fby-done', 'page3'];

  function allowed(step) {
    if (step === 'basic') return true;
    if (step === 'fbm' || step === 'fby') return PF.pageComplete('basic');
    if (step === 'page3') return PF.pageComplete('basic') && PF.pageComplete('fbm');
    if (step === 'fby3') return PF.pageComplete('basic') && PF.pageComplete('fby');
    if (step === 'fby-done') return Boolean(PF.submitted);
    return false;
  }

  PF.showStep = (step, opts = {}) => {
    // A submitted product is read-only: only its success screen is shown
    if (PF.submitted) step = 'fby-done';
    if (!STEPS.includes(step) || !allowed(step)) step = 'basic';
    if (step === 'fbm' || step === 'fby') {
      S().fulfillment = step;
      if (!S().defaultUnit.sku) S().defaultUnit.sku = S().basic.sku;
      PF.ensureYpins();
      PF.fill('fulfillment');
      PF.renderProductSummary();
      PF.renderInventory();
      PF.emit('variations-changed');
      // Arriving on FBY, "Fulfillment Type" is already answered
      if (step === 'fby') PF.autoAccept('fby', 'y-type');
    }
    S().step = step;
    PF.$$('.pf-step').forEach((el) => { el.hidden = el.dataset.step !== step; });
    if (step === 'page3') PF.$('[data-page3-title]').textContent = 'Page 3 – Review';
    if (step === 'fby3') PF.enterFby3();
    if (step === 'fby-done') PF.renderFbyDone();
    PF.renderSections(step);
    if (!opts.fromHash && location.hash !== `#${step}`) history.pushState(null, '', `${location.pathname}${location.search}#${step}`);
    if (!opts.keepScroll) window.scrollTo({ top: 0 });
    PF.icons();
  };

  window.addEventListener('popstate', () => PF.showStep(location.hash.slice(1) || 'basic', { fromHash: true }));

  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (!go || go.disabled) return;
    const target = go.dataset.go === 'fulfillment' ? S().fulfillment : go.dataset.go;
    if (target === 'page3' || target === 'fby3') saveDraft({ silent: true });
    PF.showStep(target);
  });

  // Fulfillment switch (FBM summary radios and FBY cards) moves between the two pages
  PF.on('change', ({ path, value }) => {
    if (path !== 'fulfillment') return;
    if ((S().step === 'fbm' || S().step === 'fby') && value !== S().step) PF.showStep(value);
  });

  // ---- Category cascade ---------------------------------------------------------------------

  function fillSelect(name, items, placeholder) {
    PF.$$(`select[name="${name}"]`).forEach((sel) => {
      sel.innerHTML = `<option value="">${placeholder}</option>` + items.map((c) => `<option value="${PF.esc(c.id)}">${PF.esc(c.name)}</option>`).join('');
      sel.disabled = !items.length;
    });
  }
  // Rebuilds only the dropdowns below the one that changed, so the changed one keeps its value
  function cascade(reset) {
    const b = S().basic;
    const cat = (PF.options.categories || []).find((c) => c.id === b.category);
    if (reset === 'category') { b.subCategory = ''; b.subSubCategory = ''; }
    if (reset === 'sub') b.subSubCategory = '';
    if (reset !== 'sub') {
      fillSelect('basic.subCategory', cat ? cat.children : [], 'Select Sub Category');
      PF.fill('basic.subCategory');
    }
    const sub = cat && cat.children.find((c) => c.id === b.subCategory);
    fillSelect('basic.subSubCategory', sub ? sub.children : [], 'Select Sub Sub Category');
    PF.fill('basic.subSubCategory');
  }
  PF.on('change', ({ path }) => {
    if (path === 'basic.category') cascade('category');
    if (path === 'basic.subCategory') cascade('sub');
    if (path === 'basic.productType') {
      PF.$$('[data-product-type-label]').forEach((el) => { el.textContent = S().basic.productType === 'digital' ? 'Digital' : 'Physical'; });
    }
  });

  // ---- Search tags --------------------------------------------------------------------------

  function renderTags() {
    PF.$$('[data-tags]').forEach((box) => {
      const input = box.querySelector('.pf-tags__input');
      PF.$$('.pf-tag', box).forEach((t) => t.remove());
      (S().basic.tags || []).forEach((tag, i) => {
        const el = document.createElement('span');
        el.className = 'pf-tag';
        el.innerHTML = `<span></span><button type="button" data-tag-remove="${i}" aria-label="Remove tag"><i data-lucide="x"></i></button>`;
        el.firstChild.textContent = tag;
        box.insertBefore(el, input);
      });
    });
    PF.icons();
  }
  document.addEventListener('keydown', (e) => {
    if (!e.target.matches('[data-tags] .pf-tags__input')) return;
    const input = e.target;
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const v = input.value.trim().replace(/,$/, '');
      if (v && !S().basic.tags.some((t) => t.toLowerCase() === v.toLowerCase())) {
        PF.markEdited(input);
        PF.set('basic.tags', S().basic.tags.concat(v.slice(0, 40)));
        renderTags();
      }
      input.value = '';
    } else if (e.key === 'Backspace' && !input.value && S().basic.tags.length) {
      PF.markEdited(input);
      PF.set('basic.tags', S().basic.tags.slice(0, -1));
      renderTags();
    }
  });
  document.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-tag-remove]');
    if (rm) {
      const tags = S().basic.tags.slice();
      tags.splice(Number(rm.dataset.tagRemove), 1);
      PF.markEdited(rm);
      PF.set('basic.tags', tags);
      renderTags();
    } else if (e.target.closest('[data-tags]') && !e.target.closest('.pf-tag')) {
      e.target.closest('[data-tags]').querySelector('.pf-tags__input').focus();
    }
  });

  // ---- Language tabs (both columns show on desktop; tabs switch columns on phones) ------------

  document.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-lang-tab]');
    if (!tab) return;
    const lang = tab.dataset.langTab;
    PF.$$('[data-lang-tab]').forEach((t) => {
      const on = t.dataset.langTab === lang;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
    });
    PF.$$('[data-lang-grid]').forEach((g) => { g.dataset.activeLang = lang; });
    const first = PF.$(`[data-lang="${lang}"] .pf-input, [data-lang="${lang}"] [contenteditable]`);
    if (first) first.focus();
  });

  // ---- Save Draft ----------------------------------------------------------------------------

  let dirty = false;
  PF.markClean = () => { dirty = false; };
  let saving = null;
  PF.on('change', () => { dirty = true; });

  async function saveDraft({ silent } = {}) {
    if (saving) return saving;
    const buttons = PF.$$('[data-save-draft]');
    buttons.forEach((b) => { b.disabled = true; });
    saving = PF.api.saveDraft(PF.draftId, S())
      .then(({ id }) => {
        PF.draftId = id;
        dirty = false;
        const url = new URL(location.href);
        url.searchParams.set('draft', id);
        history.replaceState(null, '', url);
        if (!silent) PF.toast('Draft saved.');
      })
      .catch((err) => PF.toast(`Could not save the draft: ${err.message}`, 'error'))
      .finally(() => { buttons.forEach((b) => { b.disabled = false; }); saving = null; });
    return saving;
  }
  PF.saveDraft = saveDraft;
  document.addEventListener('click', (e) => { if (e.target.closest('[data-save-draft]')) saveDraft(); });
  // Each accepted section is saved automatically
  PF.on('accepted', () => saveDraft({ silent: true }));
  window.addEventListener('beforeunload', (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  // ---- Preview -------------------------------------------------------------------------------

  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-preview]')) return;
    const b = S().basic;
    const p = S().pricing;
    const m = S().media;
    const images = [m.thumbnail].concat(m.gallery || []).filter(Boolean);
    const unit = PF.num(p.unitPrice);
    const discount = p.discountType === 'percent' ? unit * PF.num(p.discountAmount) / 100 : PF.num(p.discountAmount);
    const final = Math.max(0, unit - discount);
    const market = PF.num(p.marketPrice);
    PF.$('[data-preview-body]').innerHTML = `<div class="pf-preview">
      <div>${images.length ? `<img class="pf-preview__main" src="${PF.esc(images[0])}" alt="">
        <div class="pf-preview__thumbs">${images.slice(1, 6).map((u) => `<img src="${PF.esc(u)}" alt="">`).join('')}</div>` : '<div class="pf-preview__noimg">No images yet</div>'}</div>
      <div>
        <h3>${PF.esc(b.nameEn || 'Untitled product')}</h3>
        <p class="pf-preview__brand">${PF.esc(PF.brandName() || 'No brand')} · ${PF.categoryPath().map(PF.esc).join(' › ') || 'No category'}</p>
        <div class="pf-preview__price"><strong>${PF.money(final)}</strong>${market > final ? `<s>${PF.money(market)}</s>` : ''}</div>
        <p class="pf-preview__short">${PF.esc(b.shortEn)}</p>
        ${S().variations.length ? `<div class="pf-chip-list" style="margin-top:12px">${S().variations.map((v) => `<span class="pf-chip">${PF.esc(v.name)}</span>`).join('')}</div>` : ''}
        <div class="pf-preview__desc">${PF.sanitize(b.descEn) || '<span class="pf-muted-cell">No description yet.</span>'}</div>
      </div></div>`;
    PF.openModal('pf-preview-modal');
  });

  // ---- Page 1 summaries --------------------------------------------------------------------

  PF.summaries['b-info'] = () => [S().basic.nameEn, PF.categoryPath().join(' › '), PF.brandName(), S().basic.sku && `SKU ${S().basic.sku}`].filter(Boolean).join(' · ');
  PF.summaries['b-media'] = PF.summaries['m-media'] = () => {
    const m = S().media;
    const n = (m.thumbnail ? 1 : 0) + (m.gallery || []).length;
    return `${n} image${n === 1 ? '' : 's'}${m.videoUrl ? ' · video' : ''} · SEO: ${m.metaTitle}`;
  };

  // ---- Boot ----------------------------------------------------------------------------------

  function boot() {
    PF.fillAll();
    cascade();
    PF.fillAll();
    PF.$$('[data-product-type-label]').forEach((el) => { el.textContent = S().basic.productType === 'digital' ? 'Digital' : 'Physical'; });
    renderTags();
    PF.initEditors();
    PF.initUploads();
    PF.initVariations();
    PF.initFbm();
    PF.initFby();
    PF.initFby3();
    PF.initSections();
    PF.showStep(location.hash.slice(1) || S().step || 'basic', { fromHash: true });
    dirty = false;
  }
  boot();
})();
