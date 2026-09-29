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

module.exports = { getFormOptions, getListing, saveDraft, saveMedia, IMAGE_TYPES };
