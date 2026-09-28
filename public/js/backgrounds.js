(function () {
  const drawer = document.getElementById('bgDrawer');
  const stage = document.getElementById('heroStage');
  if (!drawer || !stage) return;

  const scrim = document.querySelector('.drawer-scrim');
  const grid = document.getElementById('bgGrid');
  const fileInput = document.getElementById('bgFile');
  const dropzone = document.getElementById('bgDropzone');
  const status = document.getElementById('bgStatus');

  const API = '/api/backgrounds';
  const MAX_BYTES = 5 * 1024 * 1024;
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

  let state = { activeId: null, items: [] };
  let lastFocus = null;

  // ---- helpers ----
  function setStatus(message, kind) {
    status.textContent = message || '';
    status.className = 'drawer__status' + (kind ? ' is-' + kind : '');
  }

  async function request(url, options) {
    const res = await fetch(url, options);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Request failed (' + res.status + ').');
    return body;
  }

  function applyBackground() {
    const active = state.items.find((i) => i.id === state.activeId);
    if (active) stage.style.setProperty('--hero-image', 'url("' + encodeURI(active.url) + '")');
    else stage.style.removeProperty('--hero-image');
  }

  function icon(name) {
    const i = document.createElement('i');
    i.setAttribute('data-lucide', name);
    return i;
  }

  // ---- rendering ----
  function render() {
    grid.replaceChildren();
    if (!state.items.length) {
      const li = document.createElement('li');
      li.className = 'bg-grid__empty';
      li.textContent = 'No backgrounds yet. Upload one above.';
      grid.append(li);
      return;
    }

    state.items.forEach((item) => {
      const isActive = item.id === state.activeId;
      const li = document.createElement('li');
      li.className = 'bg-item' + (isActive ? ' is-active' : '');

      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'bg-item__select';
      select.setAttribute('aria-pressed', String(isActive));
      select.setAttribute('aria-label', 'Use ' + item.label + ' as background');
      select.addEventListener('click', () => activate(item.id));

      const img = document.createElement('img');
      img.src = item.url;
      img.alt = '';
      img.loading = 'lazy';
      const label = document.createElement('span');
      label.className = 'bg-item__label';
      label.textContent = item.label;
      select.append(img, label);
      li.append(select);

      if (isActive) {
        const badge = document.createElement('span');
        badge.className = 'bg-item__badge';
        badge.append(icon('check'), document.createTextNode('Active'));
        li.append(badge);
      }

      if (!item.isBuiltin) {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'bg-item__delete';
        del.setAttribute('aria-label', 'Delete ' + item.label);
        del.append(icon('trash-2'));
        del.addEventListener('click', () => remove(item));
        li.append(del);
      }

      grid.append(li);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // ---- actions ----
  async function load() {
    try {
      state = await request(API);
      render();
    } catch (err) {
      setStatus(err.message, 'error');
    }
  }

  async function activate(id) {
    if (id === state.activeId) return;
    try {
      state = await request(API + '/' + id + '/activate', { method: 'PUT' });
      applyBackground();
      render();
      setStatus('Background updated.', 'success');
    } catch (err) {
      setStatus(err.message, 'error');
    }
  }

  async function remove(item) {
    if (!window.confirm('Delete "' + item.label + '"? This cannot be undone.')) return;
    try {
      state = await request(API + '/' + item.id, { method: 'DELETE' });
      applyBackground();
      render();
      setStatus('Background deleted.', 'success');
    } catch (err) {
      setStatus(err.message, 'error');
    }
  }

  async function upload(file) {
    if (!file) return;
    if (!ALLOWED.includes(file.type)) return setStatus('Only JPG, PNG or WebP images are allowed.', 'error');
    if (file.size > MAX_BYTES) return setStatus('Image must be 5 MB or smaller.', 'error');

    const form = new FormData();
    form.append('image', file);
    dropzone.classList.add('is-busy');
    setStatus('Uploading…');
    try {
      await request(API, { method: 'POST', body: form });
      state = await request(API);
      applyBackground();
      render();
      setStatus('Uploaded and applied.', 'success');
    } catch (err) {
      setStatus(err.message, 'error');
    } finally {
      dropzone.classList.remove('is-busy');
      fileInput.value = '';
    }
  }

  // ---- drawer open / close ----
  function open() {
    lastFocus = document.activeElement;
    drawer.hidden = false;
    scrim.hidden = false;
    requestAnimationFrame(() => drawer.classList.add('is-open'));
    setStatus('');
    load();
    drawer.querySelector('[data-bg-close]').focus();
  }

  function close() {
    drawer.classList.remove('is-open');
    scrim.hidden = true;
    setTimeout(() => { drawer.hidden = true; }, 250);
    if (lastFocus) lastFocus.focus();
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-bg-open]')) open();
    else if (e.target.closest('[data-bg-close]')) close();
  });

  document.addEventListener('keydown', (e) => {
    if (!drawer.classList.contains('is-open')) return;
    if (e.key === 'Escape') return close();
    if (e.key !== 'Tab') return;
    // Keep keyboard focus inside the open drawer
    const focusable = drawer.querySelectorAll('button, input, [href], [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // ---- upload inputs ----
  fileInput.addEventListener('change', () => upload(fileInput.files[0]));

  ['dragenter', 'dragover'].forEach((type) => dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    dropzone.classList.add('is-dragover');
  }));
  ['dragleave', 'drop'].forEach((type) => dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-dragover');
  }));
  dropzone.addEventListener('drop', (e) => upload(e.dataTransfer.files[0]));
})();
