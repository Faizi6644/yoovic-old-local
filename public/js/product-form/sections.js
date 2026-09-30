/* Section-by-section flow: later sections stay locked until the current one is accepted; any reached section
   opens and closes independently (accordion).
   States per section: locked | pending (unlocked, not accepted) | accepted. Stored in state.progress[page]. */
(function () {
  const PF = window.PF;

  PF.validators = {};   // sectionId -> () => [{ el?, msg }]  (extra checks beyond required fields)
  PF.summaries = {};    // sectionId -> () => string          (one-line summary when collapsed)
  const openByPage = {};  // page -> Set of open section ids (several can be open, like an accordion)

  // Sections switched off for this product (e.g. Master Carton Barcodes without master cartons) are skipped
  const sectionsOf = (page) => PF.$$(`.pf-section[data-page="${page}"]:not([hidden])`);
  const progressOf = (page) => (PF.state.progress[page] = PF.state.progress[page] || {});

  function statusOf(page, id, index) {
    const p = progressOf(page)[id];
    if (p === 'accepted' || p === 'pending') return p;
    return index === 0 ? 'pending' : 'locked';
  }

  // Everything required inside a section that isn't switched off by a [hidden] condition
  function isActive(el, section) {
    const hiddenAncestor = el.closest('[hidden]');
    return !hiddenAncestor || !section.contains(hiddenAncestor) || hiddenAncestor === section;
  }

  // Returns a list of { el, msg }; shows messages unless silent
  PF.validateSection = (section, silent) => {
    const errors = [];
    PF.$$('[data-required]', section).forEach((el) => {
      if (!isActive(el, section)) return;
      let empty = false;
      if (el.matches('.pf-editor')) empty = !PF.textOf(PF.get(el.dataset.editor));
      else if (el.matches('.pf-upload')) {
        const v = PF.get(el.dataset.upload);
        empty = Array.isArray(v) ? !v.length : !v;
      } else if (el.disabled) return;
      else empty = String(el.value || '').trim() === '';
      if (empty) errors.push({ el, msg: 'This field is required.' });
      else if (el.type === 'number' && (!Number.isFinite(Number(el.value)) || Number(el.value) < Number(el.min || 0))) {
        errors.push({ el, msg: `Enter a number of at least ${el.min || 0}.` });
      }
    });
    PF.$$('.pf-input[type="number"]:not([data-required])', section).forEach((el) => {
      if (!isActive(el, section) || el.value === '' || el.readOnly || el.disabled) return;
      if (!Number.isFinite(Number(el.value)) || Number(el.value) < Number(el.min || 0)) errors.push({ el, msg: `Enter a number of at least ${el.min || 0}.` });
    });
    const extra = PF.validators[section.dataset.section];
    if (extra) errors.push(...extra());

    if (!silent) {
      PF.$$('.pf-invalid', section).forEach((f) => f.classList.remove('pf-invalid'));
      PF.$$('.is-invalid', section).forEach((f) => f.classList.remove('is-invalid'));
      PF.$$('.pf-error', section).forEach((m) => { m.hidden = true; });
      errors.forEach(({ el, msg }) => { if (el) PF.showError(el, msg); });
      const box = section.querySelector('[data-section-error]');
      if (box) {
        const general = errors.filter((e) => !e.el || e.general).map((e) => e.msg);
        box.textContent = errors.length ? (general[0] || 'Please complete the highlighted fields.') : '';
        box.hidden = !errors.length;
        box.classList.remove('is-notice');
      }
    }
    return errors;
  };

  const openSet = (page) => {
    if (!openByPage[page]) {
      // First render: open the section the seller is working on
      const first = sectionsOf(page).find((s, i) => !['accepted', 'locked'].includes(statusOf(page, s.dataset.section, i)));
      openByPage[page] = new Set(first ? [first.dataset.section] : []);
    }
    return openByPage[page];
  };

  // Redraws the page's section states, summaries, arrows and final button
  PF.renderSections = (page) => {
    const list = sectionsOf(page);
    if (!list.length) return;
    list.forEach((s, i) => {
      s.dataset.state = statusOf(page, s.dataset.section, i);
      s.querySelector('.pf-num').textContent = i + 1; // numbering follows the visible sections
    });
    const open = openSet(page);
    list.forEach((s) => {
      const isOpen = open.has(s.dataset.section) && s.dataset.state !== 'locked';
      s.classList.toggle('is-open', isOpen);
      const toggle = s.querySelector('[data-section-toggle]');
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.setAttribute('aria-disabled', String(s.dataset.state === 'locked'));
      toggle.title = s.dataset.state === 'locked' ? 'Complete the previous section first' : isOpen ? 'Close section' : 'Open section';
      const summary = s.querySelector('[data-summary]');
      const fn = PF.summaries[s.dataset.section];
      summary.textContent = s.dataset.state === 'accepted' && fn ? fn() : '';
    });
    const allAccepted = list.every((s) => s.dataset.state === 'accepted');
    PF.$$(`[data-final="${page}"]`).forEach((b) => { b.disabled = !allAccepted; });
    PF.icons();
  };

  PF.pageComplete = (page) => {
    const list = sectionsOf(page);
    return list.length > 0 && list.every((s, i) => statusOf(page, s.dataset.section, i) === 'accepted');
  };

  PF.toggleSection = (page, id, open) => {
    const set = openSet(page);
    const shouldOpen = open === undefined ? !set.has(id) : open;
    if (shouldOpen) set.add(id); else set.delete(id);
    PF.renderSections(page);
    if (shouldOpen) PF.emit('section-open', { page, id });
  };

  PF.acceptSection = (section) => {
    const page = section.dataset.page;
    const id = section.dataset.section;
    if (section.dataset.state === 'locked') return false;
    const errors = PF.validateSection(section);
    if (errors.length) {
      const first = errors.find((e) => e.el);
      if (first) {
        const target = first.el.matches('.pf-editor') ? first.el.querySelector('[contenteditable]') : first.el;
        (target.focus ? target : first.el).focus?.({ preventScroll: true });
        first.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    }
    progressOf(page)[id] = 'accepted';
    const set = openSet(page);
    set.delete(id);
    // Continue with the first section still needing acceptance (sections open for viewing stay open)
    const next = sectionsOf(page).find((s, i) => statusOf(page, s.dataset.section, i) !== 'accepted');
    if (next) {
      if (!progressOf(page)[next.dataset.section]) progressOf(page)[next.dataset.section] = 'pending';
      set.add(next.dataset.section);
      PF.renderSections(page);
      PF.emit('section-open', { page, id: next.dataset.section });
      next.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      PF.renderSections(page);
      const final = PF.$(`[data-final="${page}"]`);
      if (final) final.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    PF.emit('accepted', { page, id });
    return true;
  };

  // Accepts a section whose answer is already known (e.g. Fulfillment Type on arrival) and opens the next one
  PF.autoAccept = (page, id) => {
    if (progressOf(page)[id] === 'accepted') return;
    progressOf(page)[id] = 'accepted';
    const set = openSet(page);
    set.delete(id);
    const next = sectionsOf(page).find((s, i) => statusOf(page, s.dataset.section, i) !== 'accepted');
    if (next) {
      if (!progressOf(page)[next.dataset.section]) progressOf(page)[next.dataset.section] = 'pending';
      set.add(next.dataset.section);
    }
    PF.renderSections(page);
  };

  // A seller edit inside an accepted section means it must be accepted again; other sections keep their state
  PF.markEdited = (el) => {
    const s = el && el.closest && el.closest('.pf-section');
    if (!s) return;
    const page = s.dataset.page;
    const id = s.dataset.section;
    if (progressOf(page)[id] !== 'accepted') return;
    progressOf(page)[id] = 'pending';
    const box = s.querySelector('[data-section-error]');
    if (box) { box.textContent = 'You changed this section — click Accept & Continue to confirm it.'; box.hidden = false; box.classList.add('is-notice'); }
    PF.renderSections(page);
    PF.emit('progress-changed', { page });
  };

  // Accepted sections that become invalid (e.g. a new variation without stock) drop back to pending
  PF.recheckAccepted = PF.debounce(() => {
    ['basic', 'fbm', 'fby', 'fby3'].forEach((page) => {
      let changed = false;
      sectionsOf(page).forEach((s) => {
        if (progressOf(page)[s.dataset.section] === 'accepted' && PF.validateSection(s, true).length) {
          progressOf(page)[s.dataset.section] = 'pending';
          changed = true;
        }
      });
      PF.renderSections(page);
      if (changed) PF.emit('progress-changed', { page });
    });
  }, 250);

  // Inputs that only filter or select rows are not edits
  const NOT_EDITS = '[data-var-filter], [data-check-all], [data-row-check], [type="file"]';

  PF.initSections = () => {
    document.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-section-toggle]');
      if (toggle) {
        const s = toggle.closest('.pf-section');
        if (s.dataset.state !== 'locked') PF.toggleSection(s.dataset.page, s.dataset.section);
        return;
      }
      const accept = e.target.closest('[data-accept]');
      if (accept) PF.acceptSection(accept.closest('.pf-section'));
    });
    const onEdit = (e) => {
      const el = e.target;
      if (!el.closest || !el.closest('.pf-section__body, .pf-section__tools') || el.closest(NOT_EDITS) || el.matches(NOT_EDITS)) return;
      PF.markEdited(el);
    };
    // Capture phase: runs before handlers that redraw the element that changed
    document.addEventListener('input', onEdit, true);
    document.addEventListener('change', onEdit, true);
    PF.on('change', () => PF.recheckAccepted());
    ['basic', 'fbm', 'fby', 'fby3'].forEach((p) => PF.renderSections(p));
  };
})();
