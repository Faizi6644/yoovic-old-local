const pool = require('../config/db');

// Data every page shell needs: the seller (sidebar, user menu) and the unread notification count (bell)
async function getLayoutData(sellerId) {
  const [[[seller]], [[unread]]] = await Promise.all([
    pool.query('SELECT * FROM sellers WHERE id = ?', [sellerId]),
    pool.query('SELECT COUNT(*) AS count FROM notifications WHERE seller_id = ? AND is_read = 0', [sellerId]),
  ]);
  return { seller, notifications: { unread: Number(unread.count) } };
}

module.exports = { getLayoutData };
