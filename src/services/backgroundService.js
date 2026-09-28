const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/db');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const UPLOAD_URL_PREFIX = '/uploads/backgrounds/';

async function listBackgrounds(sellerId) {
  const [[seller]] = await pool.query('SELECT hero_background_id AS activeId FROM sellers WHERE id = ?', [sellerId]);
  const [items] = await pool.query(
    `SELECT id, label, file_path AS url, is_builtin AS isBuiltin
     FROM hero_backgrounds WHERE seller_id = ?
     ORDER BY is_builtin DESC, created_at DESC, id DESC`,
    [sellerId]);
  return {
    activeId: seller ? seller.activeId : null,
    items: items.map((i) => ({ ...i, isBuiltin: Boolean(i.isBuiltin) })),
  };
}

// Active image URL, or null when none is set (the CSS fallback gradient shows instead)
async function getActiveBackground(sellerId) {
  const [[row]] = await pool.query(
    `SELECT hb.file_path AS url FROM sellers s
     JOIN hero_backgrounds hb ON hb.id = s.hero_background_id AND hb.seller_id = s.id
     WHERE s.id = ?`,
    [sellerId]);
  return row ? row.url : null;
}

async function activateBackground(sellerId, backgroundId) {
  const [result] = await pool.query(
    `UPDATE sellers s JOIN hero_backgrounds hb ON hb.id = ? AND hb.seller_id = s.id
     SET s.hero_background_id = hb.id WHERE s.id = ?`,
    [backgroundId, sellerId]);
  return result.affectedRows > 0;
}

async function addBackground(sellerId, { label, filename }) {
  const url = UPLOAD_URL_PREFIX + filename;
  const [result] = await pool.query(
    'INSERT INTO hero_backgrounds (seller_id, label, file_path) VALUES (?, ?, ?)',
    [sellerId, label, url]);
  await activateBackground(sellerId, result.insertId);
  return { id: result.insertId, label, url, isBuiltin: false };
}

// Deletes an uploaded background; if it was active, falls back to the built-in image
async function deleteBackground(sellerId, backgroundId) {
  const [[bg]] = await pool.query(
    'SELECT id, file_path, is_builtin FROM hero_backgrounds WHERE id = ? AND seller_id = ?',
    [backgroundId, sellerId]);
  if (!bg) return { ok: false, status: 404, error: 'Background not found.' };
  if (bg.is_builtin) return { ok: false, status: 400, error: 'Built-in backgrounds cannot be deleted.' };

  await pool.query('DELETE FROM hero_backgrounds WHERE id = ?', [bg.id]);
  await pool.query(
    `UPDATE sellers SET hero_background_id = (
       SELECT id FROM hero_backgrounds WHERE seller_id = ? AND is_builtin = 1 ORDER BY id LIMIT 1)
     WHERE id = ? AND hero_background_id IS NULL`,
    [sellerId, sellerId]);

  if (bg.file_path.startsWith(UPLOAD_URL_PREFIX)) {
    await fs.unlink(path.join(PUBLIC_DIR, bg.file_path)).catch(() => {});
  }
  return { ok: true };
}

module.exports = { listBackgrounds, getActiveBackground, activateBackground, addBackground, deleteBackground };
