/* Code 128 barcodes (JsBarcode), 4×6 shipping labels and printable pages.
   Barcodes are always black on white so they scan, even inside the dark theme. */
(function () {
  const PF = window.PF;

  const BAR_OPTS = { format: 'CODE128', background: '#ffffff', lineColor: '#000000', margin: 6, displayValue: true, font: 'Arial', textMargin: 2 };

  // Returns SVG markup for a barcode value
  PF.barcodeSvg = (value, opts = {}) => {
    if (!value || !window.JsBarcode) return '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    try {
      window.JsBarcode(svg, String(value), { ...BAR_OPTS, width: 1.6, height: 46, fontSize: 13, ...opts });
    } catch (e) {
      return '';
    }
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Barcode ${value}`);
    return svg.outerHTML;
  };

  // Mock tracking numbers per carrier format (no carrier API yet)
  PF.mockTracking = (carrierId, seed) => {
    const rnd = (n, chars) => Array.from({ length: n }, (_, i) => chars[(seed * 7919 + i * 104729 + Math.floor(Math.random() * 1e6)) % chars.length]).join('');
    const digits = '0123456789';
    switch (carrierId) {
      case 'ups': return `1Z${rnd(6, 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789')}${rnd(10, digits)}`;
      case 'fedex': return rnd(12, digits);
      case 'dhl': return rnd(10, digits);
      default: return `9400${rnd(18, digits)}`;
    }
  };

  // ---- Shipping label (used in the preview dialog, the sample cards and the print page) ----

  PF.labelHtml = (l) => `
    <div class="yv-label">
      <div class="yv-label__top"><strong>${PF.esc(l.carrier)}</strong><span>${PF.esc(l.service)}</span></div>
      <div class="yv-label__addr">
        <div><small>FROM</small><b>${PF.esc(l.from.name)}</b><span>${PF.esc(l.from.line)}</span></div>
        <div><small>SHIP TO</small><b>${PF.esc(l.to.name)}</b><span>${PF.esc(l.to.address)}</span></div>
      </div>
      <div class="yv-label__band">YOOVIC FBY INBOUND <span>${PF.esc(l.boxLabel)} · ${l.index + 1} of ${l.total}</span></div>
      <div class="yv-label__code"><small>TRACKING #</small>${PF.barcodeSvg(l.tracking, { height: 52, width: 1.35, fontSize: 12 })}</div>
      <div class="yv-label__code"><small>YOOVIC BOX ID</small>${PF.barcodeSvg(l.boxBarcode, { height: 40, width: 1.6, fontSize: 12 })}</div>
      <div class="yv-label__foot">
        <span>Weight: <b>${PF.esc(l.weight)}</b></span><span>Dims: <b>${PF.esc(l.dims)}</b></span>
        <span>Handling: <b>${PF.esc(l.handling)}</b></span><span>Ref: <b>${PF.esc(l.ref)}</b></span>
      </div>
    </div>`;

  const LABEL_CSS = `
    .yv-label { width: 4in; min-height: 6in; box-sizing: border-box; border: 2px solid #000; background: #fff; color: #000;
      font-family: Arial, sans-serif; font-size: 11px; display: flex; flex-direction: column; }
    .yv-label > div { border-bottom: 2px solid #000; padding: 8px 10px; }
    .yv-label > div:last-child { border-bottom: 0; }
    .yv-label__top { display: flex; justify-content: space-between; align-items: baseline; }
    .yv-label__top strong { font-size: 26px; letter-spacing: 1px; }
    .yv-label__top span { font-size: 15px; font-weight: bold; text-transform: uppercase; }
    .yv-label__addr { display: grid; grid-template-columns: 1fr 1.3fr; gap: 10px; }
    .yv-label__addr div { display: flex; flex-direction: column; gap: 2px; }
    .yv-label__addr small, .yv-label__code small { font-size: 9px; font-weight: bold; }
    .yv-label__band { background: #000; color: #fff; font-weight: bold; font-size: 13px; display: flex; justify-content: space-between; }
    .yv-label__code { display: flex; flex-direction: column; align-items: center; }
    .yv-label__code svg { max-width: 100%; height: auto; }
    .yv-label__foot { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; font-size: 10px; margin-top: auto; }`;
  PF.labelCss = LABEL_CSS;

  // ---- Printable pages ---------------------------------------------------------------------

  // items: [{ title, lines: [text], code }] for barcodes, or labels: [labelData]
  PF.openPrintPage = ({ title, items = [], labels = [], download = false }) => {
    const win = window.open('', '_blank', 'width=960,height=1000');
    if (!win) { PF.toast('Allow pop-ups for this site to print or download.', 'error'); return; }
    const cards = items.map((it) => `<div class="card"><h3>${PF.esc(it.title)}</h3>${(it.lines || []).map((t) => `<p>${PF.esc(t)}</p>`).join('')}${PF.barcodeSvg(it.code, { height: 60, width: 2 })}</div>`).join('');
    const labelPages = labels.map((l) => `<div class="label-page">${PF.labelHtml(l)}</div>`).join('');
    win.document.open();
    win.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${PF.esc(title)}</title>
      <style>
        body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #111; background: #f3f5f9; }
        .bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; padding: 12px 16px; background: #0b2270; color: #fff; border-radius: 8px; }
        .bar button { font: inherit; padding: 8px 16px; border-radius: 6px; border: 0; background: #2f8bff; color: #fff; cursor: pointer; }
        h1 { font-size: 18px; margin: 0 0 14px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
        .card { background: #fff; border: 1px solid #ccd3e0; border-radius: 6px; padding: 12px; text-align: center; break-inside: avoid; }
        .card h3 { margin: 0 0 4px; font-size: 14px; }
        .card p { margin: 0 0 2px; font-size: 11px; color: #444; }
        .card svg { max-width: 100%; height: auto; margin-top: 6px; }
        .labels { display: flex; flex-wrap: wrap; gap: 16px; }
        ${LABEL_CSS}
        @media print {
          body { background: #fff; padding: 0; }
          .bar { display: none; }
          .card { border-color: #999; }
          .label-page { page-break-after: always; }
          @page { margin: 10mm; }
        }
      </style></head><body>
      <div class="bar"><span>${download ? 'Choose <b>Save as PDF</b> as the printer to download this file.' : 'Ready to print.'}</span><button onclick="window.print()">${download ? 'Save as PDF' : 'Print'}</button></div>
      <h1>${PF.esc(title)}</h1>
      ${cards ? `<div class="grid">${cards}</div>` : ''}
      ${labelPages ? `<div class="labels">${labelPages}</div>` : ''}
      <script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 300); });<\/script>
      </body></html>`);
    win.document.close();
  };
})();
