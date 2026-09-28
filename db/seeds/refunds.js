// Demo refund requests for returned and canceled orders: older requests are resolved, newest are pending
const STATUS_SEQUENCE = [
  'refunded', 'refunded', 'refunded', 'rejected', 'refunded', 'approved',
  'refunded', 'rejected', 'approved', 'pending', 'pending', 'pending',
];
const REASONS = {
  returned: 'Item returned by customer',
  canceled: 'Order canceled after payment',
};

async function seedRefundRequests(conn, sellerId) {
  const [orders] = await conn.query(
    `SELECT id, status FROM orders
     WHERE seller_id = ? AND status IN ('returned', 'canceled')
     ORDER BY created_at LIMIT ?`,
    [sellerId, STATUS_SEQUENCE.length]);
  for (const [i, order] of orders.entries()) {
    await conn.query(
      `INSERT INTO refund_requests (seller_id, order_id, amount, reason, status, created_at)
       SELECT seller_id, id, total_amount, ?, ?, created_at + INTERVAL 1 DAY FROM orders WHERE id = ?`,
      [REASONS[order.status], STATUS_SEQUENCE[i], order.id]);
  }
  return orders.length;
}

module.exports = { seedRefundRequests };
