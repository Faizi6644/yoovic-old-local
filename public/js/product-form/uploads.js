/* Upload boxes (thumbnail, gallery, SEO image, variation media), media library and YouTube preview.
   Every box is drawn from state, so all copies of the same key (Page 1 and FBM) stay in sync. */
(function () {
  const PF = window.PF;

  const MAX_BYTES = 5 * 1024 * 1024;
  const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_GALLERY = 10;
  const RATIO_1 = 'Ratio 1:1 (500 × 500 px)';

  const btn = (cls, attr, icon, label) => `<button type="button" class="btn ${cls} btn--sm" ${attr}>${icon ? `<i data-lucide="${icon}"></i>` : ''}${label}</button>`;

  function renderBox(box) {
    const key = box.dataset.upload;
    const kind = box.dataset.kind;
    const value = PF.get(key);
    const reorderable = box.hasAttribute('data-reorderable');
    let html = '';

    if (kind === 'single') {
      html = value
        ? `<div class="pf-upload__single"><img src="${PF.esc(value)}" alt="Product thumbnail">
             <div class="pf-upload__links"><button type="button" class="pf-link-btn" data-pick>Change Image</button><button type="button" class="pf-link-btn pf-link-btn--danger" data-remove>Remove</button></div></div>
           <p class="pf-upload__ratio">${RATIO_1}</p>`
        : `<div class="pf-drop" data-pick role="button" tabindex="0" aria-label="${key.startsWith('var:') ? 'Upload main image' : 'Upload thumbnail image'}"><i data-lucide="image-plus"></i><span>${key.startsWith('var:') ? 'Upload main image' : 'Upload thumbnail image'}</span><small>${RATIO_1}</small></div>
           <div class="pf-upload__buttons">${btn('btn--primary', 'data-pick', '', 'Select Image')}${btn('pf-btn-outline', 'data-library', '', 'From Library')}</div>`;
    } else if (kind === 'seo') {
      html = value
        ? `<div class="pf-upload__single pf-upload__single--wide"><img src="${PF.esc(value)}" alt="Meta image">
             <div class="pf-upload__links"><button type="button" class="pf-link-btn" data-pick>Change Image</button><button type="button" class="pf-link-btn pf-link-btn--danger" data-remove>Remove</button></div></div>`
        : `<div class="pf-drop pf-drop--seo" data-pick role="button" tabindex="0" aria-label="Upload SEO image"><i data-lucide="image"></i><span>Upload SEO image</span>${btn('btn--primary', 'data-pick', '', 'Select Image')}</div>`;
    } else {
      const images = Array.isArray(value) ? value : [];
      const thumbs = images.length
        ? images.map((url, i) => `<div class="pf-thumb has-image" draggable="${reorderable}" data-index="${i}"><img src="${PF.esc(url)}" alt="Gallery image ${i + 1}"><button type="button" class="pf-thumb__remove" data-remove-index="${i}" aria-label="Remove image ${i + 1}"><i data-lucide="x"></i></button></div>`).join('')
        : '<div class="pf-thumb"><i data-lucide="image"></i></div>'.repeat(4);
      const canAdd = images.length < MAX_GALLERY;
      html = `${images.length ? '' : `<div class="pf-drop pf-drop--compact" data-pick role="button" tabindex="0" aria-label="Upload gallery images"><span>Drag &amp; drop images here or click to upload</span><small>${RATIO_1}</small></div>`}
        <div class="pf-thumbs">${thumbs}${canAdd ? '<button type="button" class="pf-thumb pf-thumb--add" data-pick aria-label="Add images"><i data-lucide="plus"></i></button>' : ''}</div>
        <div class="pf-upload__buttons">
          ${images.length ? btn('pf-btn-outline', 'data-pick', 'plus', 'Add Images') : btn('btn--primary', 'data-pick', '', 'Select Images')}
          ${btn('pf-btn-outline', 'data-library', '', 'From Library')}
          ${reorderable && images.length > 1 ? btn('pf-btn-outline', 'data-reorder', '', 'Reorder') : ''}
        </div>
        ${images.length ? `<p class="pf-upload__ratio">${RATIO_1}</p>` : ''}`;
    }
    box.innerHTML = html + `<input type="file" accept="${TYPES.join(',')}" hidden${kind === 'gallery' ? ' multiple' : ''}>`;
  }

  PF.renderUploads = (key) => {
    PF.$$('[data-upload]').filter((b) => !key || b.dataset.upload === key).forEach(renderBox);
    PF.icons();
  };

  function setImages(box, urls) {
    const key = box.dataset.upload;
    if (box.dataset.kind === 'gallery') {
      const current = PF.get(key) || [];
      const room = MAX_GALLERY - current.length;
      if (urls.length > room) PF.toast(`Only ${MAX_GALLERY} gallery images are allowed.`, 'error');
      PF.set(key, current.concat(urls.slice(0, Math.max(0, room))));
    } else {
      PF.set(key, urls[0]);
    }
    PF.clearError(box);
    PF.renderUploads(key);
  }

  async function handleFiles(box, fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const bad = files.find((f) => !TYPES.includes(f.type));
    if (bad) return PF.toast('Only JPG, PNG or WebP images are allowed.', 'error');
    if (files.some((f) => f.size > MAX_BYTES)) return PF.toast('Each image must be 5 MB or smaller.', 'error');
    const list = box.dataset.kind === 'gallery' ? files : files.slice(0, 1);
    box.querySelectorAll('.pf-drop').forEach((d) => d.classList.add('is-busy'));
    try {
      const urls = [];
      for (const f of list) urls.push(await PF.api.uploadImage(f));
      setImages(box, urls);
    } catch (err) {
      PF.toast(err.message, 'error');
      PF.renderUploads(box.dataset.upload);
    }
  }

  // ---- Media library dialog ----------------------------------------------------

  let libraryTarget = null;
  PF.openLibrary = (box) => {
    libraryTarget = box;
    const multiple = box.dataset.kind === 'gallery';
    const grid = PF.$('[data-library-grid]');
    grid.innerHTML = (PF.options.mediaLibrary || []).map((m) => `<li><button type="button" data-lib-url="${PF.esc(m.url)}" aria-pressed="false"><img src="${PF.esc(m.url)}" alt=""><span>${PF.esc(m.name)}</span></button></li>`).join('');
    grid.dataset.multiple = String(multiple);
    PF.$('[data-library-hint]').textContent = multiple ? 'Choose one or more images from your library.' : 'Choose an image from your library.';
    PF.$('[data-library-use]').disabled = true;
    PF.openModal('pf-library-modal');
  };
  document.addEventListener('click', (e) => {
    const item = e.target.closest('[data-lib-url]');
    if (item) {
      const grid = item.closest('[data-library-grid]');
      if (grid.dataset.multiple !== 'true') PF.$$('[data-lib-url]', grid).forEach((b) => b.setAttribute('aria-pressed', 'false'));
      item.setAttribute('aria-pressed', String(item.getAttribute('aria-pressed') !== 'true'));
      PF.$('[data-library-use]').disabled = !PF.$$('[data-lib-url][aria-pressed="true"]', grid).length;
      return;
    }
    if (e.target.closest('[data-library-use]') && libraryTarget) {
      const urls = PF.$$('[data-lib-url][aria-pressed="true"]').map((b) => b.dataset.libUrl);
      const key = libraryTarget.dataset.upload;
      PF.closeModal();
      const box = PF.$(`[data-upload="${CSS.escape(key)}"]`);
      if (box && urls.length) setImages(box, urls);
    }
  });

  // ---- Box interactions --------------------------------------------------------

  document.addEventListener('click', (e) => {
    const box = e.target.closest('[data-upload]');
    if (!box) return;
    const key = box.dataset.upload;
    if (e.target.closest('[data-pick]')) box.querySelector('input[type="file"]').click();
    else if (e.target.closest('[data-library]')) PF.openLibrary(box);
    else if (e.target.closest('[data-remove]')) { PF.set(key, null); PF.renderUploads(key); }
    else if (e.target.closest('[data-remove-index]')) {
      const i = Number(e.target.closest('[data-remove-index]').dataset.removeIndex);
      const list = (PF.get(key) || []).slice();
      list.splice(i, 1);
      PF.set(key, list);
      PF.renderUploads(key);
    } else if (e.target.closest('[data-reorder]')) {
      const thumbs = box.querySelector('.pf-thumbs');
      const on = thumbs.classList.toggle('is-reordering');
      e.target.closest('[data-reorder]').textContent = on ? 'Done' : 'Reorder';
      PF.toast(on ? 'Drag images to change their order.' : 'Image order saved.');
    }
  });
  document.addEventListener('keydown', (e) => {
    const drop = e.target.closest && e.target.closest('.pf-drop[data-pick]');
    if (drop && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); drop.closest('[data-upload]').querySelector('input[type="file"]').click(); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-upload] input[type="file"]')) handleFiles(e.target.closest('[data-upload]'), e.target.files);
  });

  // Drag & drop files onto a box, and drag thumbnails to reorder
  let dragIndex = null;
  document.addEventListener('dragstart', (e) => {
    const t = e.target.closest && e.target.closest('.pf-thumbs.is-reordering .pf-thumb.has-image');
    if (!t) return;
    dragIndex = Number(t.dataset.index);
    t.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  document.addEventListener('dragend', () => { PF.$$('.pf-thumb.is-dragging').forEach((t) => t.classList.remove('is-dragging')); });
  document.addEventListener('dragover', (e) => {
    const box = e.target.closest && e.target.closest('[data-upload]');
    if (!box) return;
    e.preventDefault();
    if (dragIndex === null) box.querySelectorAll('.pf-drop').forEach((d) => d.classList.add('is-dragover'));
  });
  document.addEventListener('dragleave', (e) => {
    const box = e.target.closest && e.target.closest('[data-upload]');
    if (box && !box.contains(e.relatedTarget)) box.querySelectorAll('.pf-drop').forEach((d) => d.classList.remove('is-dragover'));
  });
  document.addEventListener('drop', (e) => {
    const box = e.target.closest && e.target.closest('[data-upload]');
    if (!box) return;
    e.preventDefault();
    box.querySelectorAll('.pf-drop').forEach((d) => d.classList.remove('is-dragover'));
    if (dragIndex !== null) {
      const over = e.target.closest('.pf-thumb.has-image');
      const key = box.dataset.upload;
      if (over) {
        const list = (PF.get(key) || []).slice();
        const [moved] = list.splice(dragIndex, 1);
        list.splice(Number(over.dataset.index), 0, moved);
        PF.set(key, list);
        PF.renderUploads(key);
        const thumbs = PF.$(`[data-upload="${CSS.escape(key)}"] .pf-thumbs`);
        if (thumbs) thumbs.classList.add('is-reordering');
        const rb = PF.$(`[data-upload="${CSS.escape(key)}"] [data-reorder]`);
        if (rb) rb.textContent = 'Done';
      }
      dragIndex = null;
      return;
    }
    handleFiles(box, e.dataTransfer.files);
  });

  // ---- YouTube preview ---------------------------------------------------------------

  PF.youtubeId = (url) => {
    const m = String(url || '').trim().match(/^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:embed\/|watch\?(?:.*&)?v=|shorts\/)|youtu\.be\/)([\w-]{11})(?:[?&#/].*)?$/i);
    return m ? m[1] : null;
  };

  PF.renderVideo = () => {
    const url = PF.state.media.videoUrl;
    const id = PF.youtubeId(url);
    PF.$$('[data-video-preview]').forEach((box) => {
      const err = box.parentElement.querySelector('[data-video-error]');
      if (err) { err.hidden = !url || Boolean(id); err.textContent = 'Enter a valid YouTube link.'; }
      if (box.querySelector('iframe') && box.dataset.videoId === id) return;
      box.dataset.videoId = id || '';
      box.innerHTML = `<button type="button" class="pf-video__placeholder${id ? ' is-ready' : ''}" data-video-play ${id ? '' : 'disabled'} aria-label="${id ? 'Play video preview' : 'Video preview'}">
          <span class="pf-video__controls"><i data-lucide="play"></i><i data-lucide="circle-play" class="pf-video__play"></i><i data-lucide="skip-forward"></i></span>
          <span>Video Preview</span></button>`;
    });
    PF.icons();
  };
  document.addEventListener('click', (e) => {
    const play = e.target.closest('[data-video-play]');
    if (!play) return;
    const box = play.closest('[data-video-preview]');
    const id = box.dataset.videoId;
    if (!id) return;
    box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1" title="Product video preview" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  });
  PF.validators['b-media'] = PF.validators['m-media'] = () => {
    const url = PF.state.media.videoUrl;
    if (url && !PF.youtubeId(url)) {
      const input = PF.$('.pf-step:not([hidden]) [name="media.videoUrl"]');
      return [{ el: input, msg: 'Enter a valid YouTube link.' }];
    }
    return [];
  };

  PF.initUploads = () => {
    PF.renderUploads();
    PF.renderVideo();
    PF.on('change', ({ path }) => { if (path === 'media.videoUrl') PF.renderVideo(); });
  };
})();
