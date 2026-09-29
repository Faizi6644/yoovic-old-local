/* Lightweight rich-text editor for the Description fields (contenteditable + execCommand). */
(function () {
  const PF = window.PF;

  function exec(area, cmd) {
    area.focus();
    if (cmd === 'h1' || cmd === 'h2') {
      const current = document.queryCommandValue('formatBlock').toLowerCase();
      document.execCommand('formatBlock', false, current === cmd ? 'p' : cmd);
    } else if (cmd === 'code') {
      const current = document.queryCommandValue('formatBlock').toLowerCase();
      document.execCommand('formatBlock', false, current === 'pre' ? 'p' : 'pre');
    } else if (cmd === 'createLink') {
      insertLink(area);
    } else {
      document.execCommand(cmd, false, null);
    }
  }

  // The link dialog takes focus, so the text selection is saved first and restored before linking
  async function insertLink(area) {
    const sel = window.getSelection();
    const range = sel.rangeCount && area.contains(sel.getRangeAt(0).commonAncestorContainer) ? sel.getRangeAt(0).cloneRange() : null;
    const url = await PF.prompt({
      title: 'Insert link',
      message: range && !range.collapsed ? 'The selected text will link to this address.' : 'The link address will be added at the cursor.',
      input: { label: 'Link URL', type: 'url', placeholder: 'https://', value: 'https://' },
      confirmLabel: 'Insert Link',
      validate: (v) => (/^https?:\/\/[^\s.]+\.\S+$/i.test(v) ? '' : 'Enter a full link starting with http:// or https://'),
    });
    if (!url) return;
    area.focus();
    const s = window.getSelection();
    s.removeAllRanges();
    if (range) s.addRange(range);
    if (!range || range.collapsed) {
      const a = document.createElement('a');
      a.href = url;
      a.textContent = url;
      document.execCommand('insertHTML', false, a.outerHTML);
    } else {
      document.execCommand('createLink', false, url);
    }
    area.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function syncButtons(editor) {
    PF.$$('[data-cmd]', editor).forEach((b) => {
      const cmd = b.dataset.cmd;
      let on = false;
      try {
        if (['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList'].includes(cmd)) on = document.queryCommandState(cmd);
        else if (cmd === 'h1' || cmd === 'h2') on = document.queryCommandValue('formatBlock').toLowerCase() === cmd;
      } catch (e) { on = false; }
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  PF.initEditors = () => {
    PF.$$('[data-editor]').forEach((editor) => {
      const path = editor.dataset.editor;
      const area = editor.querySelector('[contenteditable]');
      area.innerHTML = PF.sanitize(PF.get(path) || '');

      const save = () => {
        // Treat an editor holding only empty markup as empty so the placeholder returns
        if (!area.textContent.trim() && !area.querySelector('li')) area.innerHTML = '';
        PF.set(path, PF.sanitize(area.innerHTML), area);
        PF.clearError(editor);
      };
      area.addEventListener('input', save);
      area.addEventListener('blur', save);
      area.addEventListener('keyup', () => syncButtons(editor));
      area.addEventListener('mouseup', () => syncButtons(editor));
      area.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, text);
      });

      editor.querySelector('.pf-editor__toolbar').addEventListener('mousedown', (e) => {
        if (e.target.closest('[data-cmd]')) e.preventDefault(); // keep the text selection
      });
      editor.querySelector('.pf-editor__toolbar').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-cmd]');
        if (!btn) return;
        exec(area, btn.dataset.cmd);
        PF.markEdited(area);
        save();
        syncButtons(editor);
      });
    });
  };
})();
