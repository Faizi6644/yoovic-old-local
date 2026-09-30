const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/db');
const mockOptions = require('../mock/productFormOptions');

const MEDIA_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'products');
const MEDIA_URL = '/uploads/products/';
const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// Dropdown options, library images and tooltips. Mock data until the catalogue API exists.
async function getFormOptions() {
  return mockOptions;
}

// Returns the saved form state of a seller's listing, or null
async function getListing(sellerId, id) {
  const [[row]] = await pool.query(
    'SELECT id, status, data FROM product_listings WHERE id = ? AND seller_id = ?', [id, sellerId]);
  if (!row) return null;
  return { id: row.id, status: row.status, data: JSON.parse(row.data) };
}

// Creates (no id) or updates a draft. Returns the listing id, or null if the id isn't the seller's.
async function saveDraft(sellerId, id, data) {
  const fulfillment = ['fbm', 'fby'].includes(data.fulfillment) ? data.fulfillment : null;
  const name = String(data.basic?.nameEn || '').slice(0, 255) || null;
  const sku = String(data.basic?.sku || '').slice(0, 100) || null;
  const json = JSON.stringify(data);

  if (!id) {
    const [res] = await pool.query(
      `INSERT INTO product_listings (seller_id, status, fulfillment_type, name_en, sku, data)
       VALUES (?, 'draft', ?, ?, ?, ?)`, [sellerId, fulfillment, name, sku, json]);
    return res.insertId;
  }
  const [res] = await pool.query(
    `UPDATE product_listings SET fulfillment_type = ?, name_en = ?, sku = ?, data = ?
     WHERE id = ? AND seller_id = ? AND status = 'draft'`, [fulfillment, name, sku, json, id, sellerId]);
  return res.affectedRows ? id : null;
}

// Stores an uploaded image and returns its public URL
async function saveMedia(buffer, mimeType) {
  const ext = IMAGE_TYPES[mimeType];
  if (!ext) throw Object.assign(new Error('Only JPG, PNG or WebP images are allowed.'), { status: 400 });
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  const name = crypto.randomBytes(12).toString('hex') + ext;
  await fs.writeFile(path.join(MEDIA_DIR, name), buffer);
  return MEDIA_URL + name;
}

// ---- FBY Page 3: barcodes and shipment submission ----------------------------------

const BARCODE_BASE = 884500000000; // 12-digit numbers: base + row id, unique across all shipments
const KINDS = ['variation', 'box', 'master'];
const MAX_PER_KIND = 500;

// Allocates new barcode numbers for a draft. counts: { variation, box, master } -> { variation: [codes], ... }
async function allocateBarcodes(sellerId, listingId, counts) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[listing]] = await conn.query(
      "SELECT id FROM product_listings WHERE id = ? AND seller_id = ? AND status = 'draft' FOR UPDATE", [listingId, sellerId]);
    if (!listing) { await conn.rollback(); return null; }
    const out = {};
    for (const kind of KINDS) {
      const n = Math.max(0, Math.min(MAX_PER_KIND, parseInt(counts[kind], 10) || 0));
      out[kind] = [];
      for (let i = 0; i < n; i += 1) {
        const [res] = await conn.query('INSERT INTO barcodes (seller_id, listing_id, kind) VALUES (?, ?, ?)', [sellerId, listingId, kind]);
        const code = String(BARCODE_BASE + res.insertId);
        await conn.query('UPDATE barcodes SET code = ? WHERE id = ?', [code, res.insertId]);
        out[kind].push(code);
      }
    }
    await conn.commit();
    return out;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Saves the final draft data, creates the shipment and marks the listing submitted. Returns the shipment code.
async function submitFbyShipment(sellerId, listingId, data, summary) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[listing]] = await conn.query(
      "SELECT id FROM product_listings WHERE id = ? AND seller_id = ? AND status = 'draft' FOR UPDATE", [listingId, sellerId]);
    if (!listing) { await conn.rollback(); return null; }
    const [res] = await conn.query(
      `INSERT INTO fby_shipments (seller_id, listing_id, warehouse_id, total_units, total_boxes, shipping_method, carrier, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sellerId, listingId, summary.warehouse, summary.totalUnits, summary.totalBoxes, summary.method, summary.carrier, JSON.stringify(summary)]);
    const code = `SHP-${new Date().getFullYear()}-${String(res.insertId).padStart(5, '0')}`;
    await conn.query('UPDATE fby_shipments SET shipment_code = ? WHERE id = ?', [code, res.insertId]);
    data.shipment = { code, submittedAt: new Date().toISOString() };
    await conn.query(
      `UPDATE product_listings SET status = 'submitted', fulfillment_type = 'fby', name_en = ?, sku = ?, data = ? WHERE id = ?`,
      [String(data.basic?.nameEn || '').slice(0, 255) || null, String(data.basic?.sku || '').slice(0, 100) || null, JSON.stringify(data), listingId]);
    await conn.commit();
    return code;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getShipmentForListing(sellerId, listingId) {
  const [[row]] = await pool.query(
    `SELECT shipment_code AS code, status, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS submittedAt
     FROM fby_shipments WHERE seller_id = ? AND listing_id = ? ORDER BY id DESC LIMIT 1`, [sellerId, listingId]);
  return row || null;
}

module.exports = {
  getFormOptions, getListing, saveDraft, saveMedia, IMAGE_TYPES,
  allocateBarcodes, submitFbyShipment, getShipmentForListing,
};
