const pool = require('../config/db');
const navigation = require('../config/navigation');

// Badge sources: '<source>:<status>' in navigation.js counts rows of this table by status
const SOURCES = {
  orders: 'orders',
  refunds: 'refund_requests',
};

// Submenu entries with a count badge, e.g. { slug: 'orders/pending', badge: 'orders:pending' }
const BADGES = navigation
  .flatMap((g) => g.items)
  .flatMap((i) => i.children || [])
  .filter((c) => c.badge)
  .map((c) => {
    const [source, status] = c.badge.split(':');
    if (!SOURCES[source]) throw new Error(`Unknown badge source "${source}" in navigation.js`);
    return { slug: c.slug, source, status };
  });

async function countByStatus(sellerId, source) {
  const [rows] = await pool.query(
    `SELECT status, COUNT(*) AS count FROM ${SOURCES[source]} WHERE seller_id = ? GROUP BY status`, [sellerId]);
  const counts = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
  counts.all = rows.reduce((sum, r) => sum + Number(r.count), 0);
  return counts;
}

// Returns { [childSlug]: count } for the sidebar badges
async function getNavBadges(sellerId) {
  const sources = [...new Set(BADGES.map((b) => b.source))];
  const results = await Promise.all(sources.map((s) => countByStatus(sellerId, s)));
  const bySource = Object.fromEntries(sources.map((s, i) => [s, results[i]]));
  return Object.fromEntries(BADGES.map((b) => [b.slug, bySource[b.source][b.status] || 0]));
}

module.exports = { getNavBadges };
