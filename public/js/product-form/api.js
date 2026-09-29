/* API layer for the Add New Product flow — the single place to change when the real backend is ready.
   Drafts: Express endpoints backed by MySQL (product_listings, status "draft").
   Options: mock data rendered into the page (src/mock/productFormOptions.js). */
(function () {
  const PF = window.PF;

  async function request(url, options) {
    const res = await fetch(url, options);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status}).`);
    return body;
  }

  PF.api = {
    getOptions: async () => PF.options,

    loadDraft: (id) => request(`/api/products/drafts/${encodeURIComponent(id)}`),

    // Creates the draft on first save, then updates it. Resolves to { id, savedAt }.
    saveDraft: (id, data) => request(id ? `/api/products/drafts/${encodeURIComponent(id)}` : '/api/products/drafts', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    }),

    // Uploads one image file and resolves to its public URL
    uploadImage: async (file) => {
      const { url } = await request('/api/products/media', {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      return url;
    },
  };
})();
