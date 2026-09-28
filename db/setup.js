// Creates the database, applies schema.sql and seeds demo data for one seller.
// The current week ends yesterday, so the dashboard always shows fresh data.
// Usage: npm run db:setup

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { seedRefundRequests } = require('./seeds/refunds');

const DB_NAME = process.env.DB_NAME || 'yoovic_seller';

// Deterministic PRNG so every setup produces the same dataset
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260927);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

const pad = (n) => String(n).padStart(2, '0');
const toDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toDateTime = (d) => `${toDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000);

// Split an integer total into `parts` random positive shares that sum exactly to it
function splitInt(total, parts, jitter = 0.35) {
  const weights = Array.from({ length: parts }, () => 1 - jitter + rand() * jitter * 2);
  const sum = weights.reduce((a, b) => a + b, 0);
  const out = weights.map((w) => Math.floor((w / sum) * total));
  out[out.length - 1] += total - out.reduce((a, b) => a + b, 0);
  return out;
}

// ---- Weekly targets (index 0 = oldest day) --------------------------------
const WEEKS = {
  previous: {
    revenue: [1420, 1500, 1580, 1610, 1650, 1640, 1695], // 11,095
    orders: [22, 23, 24, 24, 25, 25, 25],                // 168
    profit: 2800,
    visitors: 3542,
    ads: { spend: 1049, sales: 4245, conversions: 196 },
    customers: { newCustomers: 562, repeatCustomers: 1012, repeatRate: 41.31 },
  },
  current: {
    revenue: [1380, 1620, 1540, 1860, 2140, 1900, 2040], // 12,480
    orders: [20, 24, 23, 27, 31, 27, 30],                // 182
    profit: 3240,
    visitors: 3792,
    ads: { spend: 1240, sales: 5620, conversions: 248 },
    customers: { newCustomers: 642, repeatCustomers: 1230, repeatRate: 42.8 },
  },
};

// Current-week status mix, oldest orders first (canceled are scattered separately)
const CURRENT_STATUS_SEQUENCE = [
  ['returned', 5], ['delivered', 26], ['out_for_delivery', 32],
  ['packaging', 38], ['confirmed', 45], ['pending', 28],
];
const CURRENT_CANCELED = 8;

const BREAKDOWN_SHARES = { shipping: 0.09, commission: 0.067, discount: 0.05, other: 0.053 }; // product gets the rest

function buildOrders(sellerId, weekStart, week, startNumber) {
  const orders = [];
  week.revenue.forEach((dayRevenue, dayIdx) => {
    const count = week.orders[dayIdx];
    const amounts = splitInt(dayRevenue * 100, count);
    const minutes = Array.from({ length: count }, () => randInt(8 * 60, 22 * 60 + 59)).sort((a, b) => a - b);
    amounts.forEach((cents, i) => {
      const at = addDays(weekStart, dayIdx);
      at.setHours(0, minutes[i], randInt(0, 59), 0);
      orders.push({ seller_id: sellerId, cents, created_at: at });
    });
  });

  // Net profit proportional to order value, remainder absorbed by the last order
  const totalCents = orders.reduce((a, o) => a + o.cents, 0);
  const profitCents = week.profit * 100;
  let assigned = 0;
  orders.forEach((o, i) => {
    o.profitCents = i === orders.length - 1 ? profitCents - assigned : Math.round((o.cents * profitCents) / totalCents);
    assigned += o.profitCents;
  });

  orders.forEach((o, i) => {
    const part = (share) => Math.round(o.cents * share);
    const shipping = part(BREAKDOWN_SHARES.shipping);
    const commission = part(BREAKDOWN_SHARES.commission);
    const discount = part(BREAKDOWN_SHARES.discount);
    const other = part(BREAKDOWN_SHARES.other);
    o.product = o.cents - shipping - commission - discount - other;
    Object.assign(o, { shipping, commission, discount, other });
    o.order_number = `ORD-${startNumber + i}`;
  });
  return orders;
}

function assignCurrentStatuses(orders) {
  const canceledIdx = new Set();
  while (canceledIdx.size < CURRENT_CANCELED) canceledIdx.add(randInt(0, orders.length - 1));
  const sequence = CURRENT_STATUS_SEQUENCE.flatMap(([status, n]) => Array(n).fill(status));
  let s = 0;
  orders.forEach((o, i) => { o.status = canceledIdx.has(i) ? 'canceled' : sequence[s++]; });
}

function assignPreviousStatuses(orders) {
  orders.forEach((o) => {
    const r = rand();
    o.status = r < 0.02 ? 'canceled' : r < 0.045 ? 'returned' : 'delivered';
  });
}

function buildProducts(sellerId) {
  const items = ['Wireless Earbuds', 'Smart Watch', 'Bluetooth Speaker', 'Phone Case', 'USB-C Cable', 'Power Bank',
    'Laptop Stand', 'Desk Lamp', 'Yoga Mat', 'Water Bottle', 'Backpack', 'Sunglasses', 'Running Shoes',
    'Coffee Mug', 'Scented Candle', 'Face Serum', 'Hair Dryer', 'Gaming Mouse', 'Mechanical Keyboard',
    'Webcam', 'Ring Light', 'Travel Pillow', 'Wall Clock', 'Throw Blanket', 'Kitchen Scale'];
  const variants = ['Classic', 'Pro', 'Lite', 'Max', 'Mini'];
  const names = [];
  outer: for (const v of variants) for (const it of items) { names.push(`${it} ${v}`); if (names.length === 105) break outer; }
  names[0] = 'Wireless Earbuds'; // referenced by the low-stock notification

  // Buckets chosen so the dashboard shows 5 out / 12 low / 28 restock / 6 aging / 78% health
  const plan = [
    ...Array(12).fill('low'), ...Array(5).fill('out'), ...Array(11).fill('moderate'),
    ...Array(6).fill('aging'), ...Array(71).fill('healthy'),
  ];
  return names.map((name, i) => {
    const bucket = plan[i];
    const reorder = bucket === 'moderate' ? 10 : 15;
    const stock = {
      out: 0, low: randInt(1, reorder), moderate: randInt(reorder + 1, reorder * 2),
      aging: randInt(40, 120), healthy: randInt(40, 300),
    }[bucket];
    const lastSold = bucket === 'aging' ? hoursAgo(randInt(100, 200) * 24) : hoursAgo(randInt(1, 30 * 24));
    return [sellerId, name, `BM-${1001 + i}`, (randInt(899, 12999) / 100).toFixed(2), stock, reorder,
      toDateTime(lastSold), toDateTime(hoursAgo(randInt(200, 400) * 24))];
  });
}

function dailyMetricsRows(sellerId, weekStart, week) {
  const visitors = splitInt(week.visitors, 7, 0.1);
  const spend = splitInt(week.ads.spend * 100, 7);
  const sales = splitInt(week.ads.sales * 100, 7);
  const conv = splitInt(week.ads.conversions, 7);
  return Array.from({ length: 7 }, (_, i) => [
    sellerId, toDate(addDays(weekStart, i)), visitors[i],
    (spend[i] / 100).toFixed(2), (sales[i] / 100).toFixed(2), conv[i],
  ]);
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  console.log(`Creating database "${DB_NAME}"...`);
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${DB_NAME}\``);
  await conn.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

  const [sellerRes] = await conn.query(
    'INSERT INTO sellers (store_name, owner_name, country_name, country_code) VALUES (?, ?, ?, ?)',
    ['BellaMart', 'BellaMart Ali', 'United States of America', 'US'],
  );
  const sellerId = sellerRes.insertId;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const currentStart = addDays(today, -7);
  const previousStart = addDays(today, -14);

  const prevOrders = buildOrders(sellerId, previousStart, WEEKS.previous, 11996);
  const currOrders = buildOrders(sellerId, currentStart, WEEKS.current, 11996 + prevOrders.length);
  assignPreviousStatuses(prevOrders);
  assignCurrentStatuses(currOrders);

  const money = (c) => (c / 100).toFixed(2);
  const orderRows = [...prevOrders, ...currOrders].map((o) => [
    o.seller_id, o.order_number, o.status, money(o.product), money(o.shipping), money(o.commission),
    money(o.discount), money(o.other), money(o.cents), money(o.profitCents), toDateTime(o.created_at),
  ]);
  await conn.query(
    `INSERT INTO orders (seller_id, order_number, status, product_amount, shipping_amount, commission_amount,
      discount_amount, other_amount, total_amount, net_profit, created_at) VALUES ?`, [orderRows]);

  await conn.query(
    'INSERT INTO products (seller_id, name, sku, price, stock, reorder_level, last_sold_at, created_at) VALUES ?',
    [buildProducts(sellerId)]);

  await conn.query(
    `INSERT INTO store_daily_metrics (seller_id, metric_date, visitors, ad_spend, ad_attributed_sales, ad_conversions) VALUES ?`,
    [[...dailyMetricsRows(sellerId, previousStart, WEEKS.previous),
      ...dailyMetricsRows(sellerId, currentStart, WEEKS.current)]]);

  await conn.query(
    'INSERT INTO customer_weekly_metrics (seller_id, week_start, new_customers, repeat_customers, repeat_purchase_rate) VALUES ?',
    [[previousStart, currentStart].map((d, i) => {
      const c = (i === 0 ? WEEKS.previous : WEEKS.current).customers;
      return [sellerId, toDate(d), c.newCustomers, c.repeatCustomers, c.repeatRate];
    })]);

  await conn.query(
    `INSERT INTO seller_finances (seller_id, withdrawable_balance, pending_withdraw, pending_clearance, already_withdrawn,
      commission_given, delivery_charges, vat_given, collected_cash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [sellerId, 2560, 480, 320, 1240, 620, 480, 210, 350]);

  const payouts = [
    ['New York', 'USA', 'US', 1480, 'credited', 3],
    ['London', 'UK', 'GB', 560, 'credited', 5],
    ['Toronto', 'Canada', 'CA', 620, 'credited', 7],
    ['Dubai', 'UAE', 'AE', 245, 'credited', 9],
    ['Shanghai', 'China', 'CN', 410, 'in_transit', 11],
    ['Singapore', 'Singapore', 'SG', 320, 'credited', 13],
    ['Sydney', 'Australia', 'AU', 890, 'credited', 15],
  ];
  await conn.query(
    'INSERT INTO payouts (seller_id, city, country_label, country_code, amount, status, created_at) VALUES ?',
    [payouts.map(([city, label, code, amount, status, h]) => [sellerId, city, label, code, amount, status, toDateTime(hoursAgo(h))])]);

  const latestOrder = currOrders[currOrders.length - 1].order_number;
  const notifications = [
    ['order', `New order received #${latestOrder}`, 0, 2],
    ['stock', 'Low stock alert – Wireless Earbuds', 0, 4],
    ['campaign', 'Campaign approved', 0, 6],
    ['withdrawal', 'Withdrawal completed', 1, 8],
    ['review', 'New product review received', 1, 10],
  ];
  await conn.query(
    'INSERT INTO notifications (seller_id, type, message, is_read, created_at) VALUES ?',
    [notifications.map(([type, msg, read, h]) => [sellerId, type, msg, read, toDateTime(hoursAgo(h))])]);

  const [bgRes] = await conn.query(
    'INSERT INTO hero_backgrounds (seller_id, label, file_path, is_builtin) VALUES (?, ?, ?, 1)',
    [sellerId, 'Blue Waves', '/images/hero-bg.jpg']);
  await conn.query('UPDATE sellers SET hero_background_id = ? WHERE id = ?', [bgRes.insertId, sellerId]);

  await seedRefundRequests(conn, sellerId);

  await conn.end();
  console.log(`Done. Seeded seller #${sellerId} with ${orderRows.length} orders (${toDate(currentStart)} → ${toDate(addDays(today, -1))}).`);
}

main().catch((err) => {
  console.error('Database setup failed:', err.message);
  process.exit(1);
});
