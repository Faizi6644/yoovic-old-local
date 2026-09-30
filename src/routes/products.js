const express = require('express');
const { SELLER_ID } = require('../config/seller');
const { getLayoutData } = require('../services/layoutService');
const products = require('../services/productService');

const router = express.Router();

const MAX_IMAGE_MB = 5;

// ---- Page ----

router.get('/products/add', async (req, res, next) => {
  try {
    const draftId = Number(req.query.draft) || null;
    const [layout, options, listing] = await Promise.all([
      getLayoutData(SELLER_ID),
      products.getFormOptions(),
      draftId ? products.getListing(SELLER_ID, draftId) : null,
    ]);
    // A submitted listing opens read-only on its success screen
    const shipment = listing && listing.status === 'submitted' ? await products.getShipmentForListing(SELLER_ID, listing.id) : null;
    res.render('products/add', {
      ...layout,
      options,
      draft: listing ? { id: listing.id, data: listing.data, status: listing.status, shipment } : null,
      draftMissing: Boolean(draftId && !listing),
      active: 'products/add',
    });
  } catch (err) {
    next(err);
  }
});

// ---- API (drafts are stored in MySQL with status "draft") ----

const api = express.Router();
api.use(express.json({ limit: '2mb' }));

api.get('/drafts/:id', async (req, res, next) => {
  try {
    const listing = await products.getListing(SELLER_ID, Number(req.params.id));
    if (!listing) return res.status(404).json({ error: 'Draft not found.' });
    res.json(listing);
  } catch (err) { next(err); }
});

api.post('/drafts', async (req, res, next) => {
  try {
    if (!req.body || typeof req.body.data !== 'object') return res.status(400).json({ error: 'Missing draft data.' });
    const id = await products.saveDraft(SELLER_ID, null, req.body.data);
    res.status(201).json({ id, savedAt: new Date().toISOString() });
  } catch (err) { next(err); }
});

api.put('/drafts/:id', async (req, res, next) => {
  try {
    if (!req.body || typeof req.body.data !== 'object') return res.status(400).json({ error: 'Missing draft data.' });
    const id = await products.saveDraft(SELLER_ID, Number(req.params.id), req.body.data);
    if (!id) return res.status(404).json({ error: 'Draft not found.' });
    res.json({ id, savedAt: new Date().toISOString() });
  } catch (err) { next(err); }
});

// FBY Page 3: allocate unique barcode numbers. Body: { variation, box, master } counts
api.post('/drafts/:id/barcodes', async (req, res, next) => {
  try {
    const codes = await products.allocateBarcodes(SELLER_ID, Number(req.params.id), req.body || {});
    if (!codes) return res.status(404).json({ error: 'Draft not found.' });
    res.status(201).json(codes);
  } catch (err) { next(err); }
});

// FBY Page 3: submit the shipment. Body: { data, summary }
api.post('/drafts/:id/submit-fby', async (req, res, next) => {
  try {
    const { data, summary } = req.body || {};
    const problems = [];
    if (!data || typeof data !== 'object' || data.fulfillment !== 'fby') problems.push('The product is not set to FBY.');
    if (!summary || typeof summary !== 'object') problems.push('Missing shipment summary.');
    else {
      if (!(summary.totalUnits > 0)) problems.push('No units selected to send.');
      if (!(summary.totalBoxes > 0)) problems.push('No boxes configured.');
      if (!summary.warehouse) problems.push('No warehouse selected.');
      if (!['self', 'yoovic'].includes(summary.method)) problems.push('No shipping method selected.');
      if (!summary.carrier) problems.push('No carrier selected.');
      if (!Array.isArray(summary.boxes) || summary.boxes.length !== summary.totalBoxes || summary.boxes.some((b) => !b.barcode || !b.tracking)) {
        problems.push('Every box needs a barcode and a tracking number.');
      }
      if (!summary.labelsGenerated) problems.push('Shipping labels have not been generated.');
    }
    if (problems.length) return res.status(400).json({ error: problems.join(' ') });
    const code = await products.submitFbyShipment(SELLER_ID, Number(req.params.id), data, summary);
    if (!code) return res.status(404).json({ error: 'Draft not found or already submitted.' });
    res.status(201).json({ shipmentCode: code });
  } catch (err) { next(err); }
});

// Raw image body with its Content-Type, e.g. fetch(url, { method: 'POST', body: file })
api.post('/media', express.raw({ type: Object.keys(products.IMAGE_TYPES), limit: `${MAX_IMAGE_MB}mb` }), async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body) || !req.body.length) {
      return res.status(400).json({ error: 'Only JPG, PNG or WebP images are allowed.' });
    }
    const url = await products.saveMedia(req.body, req.get('content-type'));
    res.status(201).json({ url });
  } catch (err) { next(err); }
});

// eslint-disable-next-line no-unused-vars
api.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: `File is too large (max ${MAX_IMAGE_MB} MB).` });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

router.use('/api/products', api);

module.exports = router;
