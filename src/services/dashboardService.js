const pool = require('../config/db');
const { addDays, dateRange } = require('../utils/dates');

const PERIOD_DAYS = 7;
const TREND_DAYS = 14;

const STATUS_META = [
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'packaging', label: 'Packaging' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'canceled', label: 'Canceled' },
  { key: 'returned', label: 'Returned' },
];

const growth = (cur, prev) => (prev ? ((cur - prev) / prev) * 100 : null);
const share = (part, whole) => (whole ? (part / whole) * 100 : 0);

// The reporting window ends on the most recent day with orders (falls back to yesterday)
async function resolvePeriod(sellerId) {
  const [[row]] = await pool.query(
    'SELECT DATE_FORMAT(MAX(created_at), "%Y-%m-%d") AS lastDay FROM orders WHERE seller_id = ?', [sellerId]);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const end = row.lastDay || yesterday;
  const start = addDays(end, -(PERIOD_DAYS - 1));
  return {
    start, end,
    prevStart: addDays(start, -PERIOD_DAYS), prevEnd: addDays(start, -1),
    trendStart: addDays(end, -(TREND_DAYS - 1)),
  };
}

async function getSeller(sellerId) {
  const [[seller]] = await pool.query('SELECT * FROM sellers WHERE id = ?', [sellerId]);
  return seller || null;
}

async function getOrderTotals(sellerId, p) {
  const [[row]] = await pool.query(
    `SELECT
       SUM(created_at >= ? AND created_at < ?)                                   AS curOrders,
       SUM(IF(created_at >= ? AND created_at < ?, total_amount, 0))              AS curSales,
       SUM(IF(created_at >= ? AND created_at < ?, net_profit, 0))                AS curProfit,
       SUM(created_at >= ? AND created_at < ?)                                   AS prevOrders,
       SUM(IF(created_at >= ? AND created_at < ?, total_amount, 0))              AS prevSales,
       SUM(IF(created_at >= ? AND created_at < ?, net_profit, 0))                AS prevProfit
     FROM orders
     WHERE seller_id = ? AND created_at >= ? AND created_at < ?`,
    [
      ...Array(3).fill([p.start, addDays(p.end, 1)]).flat(),
      ...Array(3).fill([p.prevStart, p.start]).flat(),
      sellerId, p.prevStart, addDays(p.end, 1),
    ]);
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v) || 0]));
}

async function getDailyMetrics(sellerId, p) {
  const [rows] = await pool.query(
    `SELECT metric_date AS day, visitors, ad_spend AS spend, ad_attributed_sales AS sales, ad_conversions AS conversions
     FROM store_daily_metrics
     WHERE seller_id = ? AND metric_date BETWEEN ? AND ?
     ORDER BY metric_date`,
    [sellerId, p.prevStart, p.end]);
  const sum = (from, to, key) => rows.filter((r) => r.day >= from && r.day <= to).reduce((a, r) => a + Number(r[key]), 0);
  const period = (from, to) => ({
    visitors: sum(from, to, 'visitors'),
    spend: sum(from, to, 'spend'),
    sales: sum(from, to, 'sales'),
    conversions: sum(from, to, 'conversions'),
  });
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return {
    cur: period(p.start, p.end),
    prev: period(p.prevStart, p.prevEnd),
    daily: dateRange(p.start, PERIOD_DAYS).map((day) => ({
      day,
      spend: Number(byDay.get(day)?.spend || 0),
      sales: Number(byDay.get(day)?.sales || 0),
    })),
  };
}

async function getTrend(sellerId, p) {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day,
            SUM(total_amount) AS revenue, SUM(net_profit) AS profit, COUNT(*) AS orders
     FROM orders
     WHERE seller_id = ? AND created_at >= ? AND created_at < ?
     GROUP BY day ORDER BY day`,
    [sellerId, p.trendStart, addDays(p.end, 1)]);
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return dateRange(p.trendStart, TREND_DAYS).map((day) => ({
    day,
    revenue: Number(byDay.get(day)?.revenue || 0),
    profit: Number(byDay.get(day)?.profit || 0),
    orders: Number(byDay.get(day)?.orders || 0),
  }));
}

async function getOrderStatus(sellerId, p) {
  const [rows] = await pool.query(
    `SELECT status, COUNT(*) AS count FROM orders
     WHERE seller_id = ? AND created_at >= ? AND created_at < ?
     GROUP BY status`,
    [sellerId, p.start, addDays(p.end, 1)]);
  const counts = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
  const total = rows.reduce((a, r) => a + Number(r.count), 0);
  return {
    total,
    items: STATUS_META.map((s) => ({ ...s, count: counts[s.key] || 0, share: share(counts[s.key] || 0, total) })),
  };
}

async function getRevenueBreakdown(sellerId, p) {
  const [[row]] = await pool.query(
    `SELECT SUM(product_amount) AS product, SUM(shipping_amount) AS shipping, SUM(commission_amount) AS commission,
            SUM(discount_amount) AS discount, SUM(other_amount) AS other, SUM(total_amount) AS total
     FROM orders WHERE seller_id = ? AND created_at >= ? AND created_at < ?`,
    [sellerId, p.start, addDays(p.end, 1)]);
  const total = Number(row.total) || 0;
  const items = [
    ['Product Sales', row.product], ['Shipping Charges', row.shipping], ['Commission', row.commission],
    ['Discounts', row.discount], ['Other', row.other],
  ].map(([label, amount]) => ({ label, amount: Number(amount) || 0, share: share(Number(amount) || 0, total) }));
  return { total, items };
}

// Low stock: 0 < stock <= reorder level. Restock needed: stock <= 2x reorder level (includes low & out).
// Aging: no sale in 90 days. Stock health: share of products that are in stock, above reorder level and not aging.
async function getInventory(sellerId) {
  const [[row]] = await pool.query(
    `SELECT
       COUNT(*)                                                     AS total,
       SUM(stock > 0 AND stock <= reorder_level)                    AS lowStock,
       SUM(stock = 0)                                               AS outOfStock,
       SUM(stock <= reorder_level * 2)                              AS restockNeeded,
       SUM(last_sold_at IS NULL OR last_sold_at < NOW() - INTERVAL 90 DAY) AS aging,
       SUM(stock > reorder_level AND last_sold_at >= NOW() - INTERVAL 90 DAY) AS healthy
     FROM products WHERE seller_id = ?`,
    [sellerId]);
  const n = (v) => Number(v) || 0;
  return {
    lowStock: n(row.lowStock), outOfStock: n(row.outOfStock),
    restockNeeded: n(row.restockNeeded), aging: n(row.aging),
    health: share(n(row.healthy), n(row.total)),
  };
}

async function getCustomers(sellerId, p) {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(week_start, '%Y-%m-%d') AS weekStart, new_customers AS newCustomers,
            repeat_customers AS repeatCustomers, repeat_purchase_rate AS repeatRate
     FROM customer_weekly_metrics
     WHERE seller_id = ? AND week_start <= ?
     ORDER BY week_start DESC LIMIT 2`,
    [sellerId, p.start]);
  const [cur = { newCustomers: 0, repeatCustomers: 0, repeatRate: 0 }, prev] = rows;
  const total = cur.newCustomers + cur.repeatCustomers;
  return {
    newCustomers: cur.newCustomers,
    repeatCustomers: cur.repeatCustomers,
    repeatRate: Number(cur.repeatRate),
    total,
    newShare: share(cur.newCustomers, total),
    repeatShare: share(cur.repeatCustomers, total),
    newGrowth: prev ? growth(cur.newCustomers, prev.newCustomers) : null,
    repeatGrowth: prev ? growth(cur.repeatCustomers, prev.repeatCustomers) : null,
    rateGrowth: prev ? growth(Number(cur.repeatRate), Number(prev.repeatRate)) : null,
  };
}

async function getFinances(sellerId) {
  const [[row]] = await pool.query('SELECT * FROM seller_finances WHERE seller_id = ?', [sellerId]);
  return row || {};
}

async function getPayouts(sellerId) {
  const [rows] = await pool.query(
    `SELECT city, country_label AS countryLabel, LOWER(country_code) AS countryCode, amount, status
     FROM payouts WHERE seller_id = ? ORDER BY created_at DESC LIMIT 7`,
    [sellerId]);
  return rows;
}

async function getNotifications(sellerId) {
  const [[rows], [[unread]]] = await Promise.all([
    pool.query(
      `SELECT id, type, message, is_read AS isRead, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
       FROM notifications WHERE seller_id = ? ORDER BY created_at DESC LIMIT 5`, [sellerId]),
    pool.query('SELECT COUNT(*) AS count FROM notifications WHERE seller_id = ? AND is_read = 0', [sellerId]),
  ]);
  return { items: rows, unread: Number(unread.count) };
}

async function getDashboard(sellerId) {
  const seller = await getSeller(sellerId);
  if (!seller) return null;

  const period = await resolvePeriod(sellerId);
  const [totals, metrics, trend, orderStatus, revenue, inventory, customers, finances, payouts, notifications] =
    await Promise.all([
      getOrderTotals(sellerId, period),
      getDailyMetrics(sellerId, period),
      getTrend(sellerId, period),
      getOrderStatus(sellerId, period),
      getRevenueBreakdown(sellerId, period),
      getInventory(sellerId),
      getCustomers(sellerId, period),
      getFinances(sellerId),
      getPayouts(sellerId),
      getNotifications(sellerId),
    ]);

  const conversion = share(totals.curOrders, metrics.cur.visitors);
  const prevConversion = share(totals.prevOrders, metrics.prev.visitors);
  const roas = metrics.cur.spend ? metrics.cur.sales / metrics.cur.spend : 0;
  const prevRoas = metrics.prev.spend ? metrics.prev.sales / metrics.prev.spend : 0;

  return {
    seller,
    period,
    kpis: {
      sales: { value: totals.curSales, growth: growth(totals.curSales, totals.prevSales) },
      orders: { value: totals.curOrders, growth: growth(totals.curOrders, totals.prevOrders) },
      profit: { value: totals.curProfit, growth: growth(totals.curProfit, totals.prevProfit) },
      conversion: { value: conversion, growth: growth(conversion, prevConversion) },
      balance: { value: Number(finances.withdrawable_balance) || 0 },
    },
    trend,
    orderStatus,
    revenue,
    inventory,
    advertising: {
      spend: { value: metrics.cur.spend, growth: growth(metrics.cur.spend, metrics.prev.spend) },
      sales: { value: metrics.cur.sales, growth: growth(metrics.cur.sales, metrics.prev.sales) },
      roas: { value: roas, growth: growth(roas, prevRoas) },
      conversions: { value: metrics.cur.conversions, growth: growth(metrics.cur.conversions, metrics.prev.conversions) },
      daily: metrics.daily,
    },
    customers,
    finances,
    payouts,
    notifications,
  };
}

module.exports = { getDashboard };
