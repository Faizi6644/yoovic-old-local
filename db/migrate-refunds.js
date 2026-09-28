// Adds the refund_requests table to an existing database and seeds demo data if it is empty.
// Usage: node db/migrate-refunds.js   (fresh installs get this from npm run db:setup)
require('dotenv').config({ quiet: true });
const mysql = require('mysql2/promise');
const { seedRefundRequests } = require('./seeds/refunds');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'yoovic_seller',
  });
  await conn.query(`CREATE TABLE IF NOT EXISTS refund_requests (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  seller_id   INT UNSIGNED  NOT NULL,
  order_id    INT UNSIGNED  NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  reason      VARCHAR(255)  NOT NULL,
  status      ENUM('pending','approved','refunded','rejected') NOT NULL DEFAULT 'pending',
  created_at  DATETIME      NOT NULL,
  KEY idx_refunds_seller_status (seller_id, status),
  CONSTRAINT fk_refunds_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE,
  CONSTRAINT fk_refunds_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM refund_requests');
  if (n) console.log(`refund_requests already has ${n} rows; nothing seeded.`);
  else console.log(`Seeded ${await seedRefundRequests(conn, Number(process.env.SELLER_ID || 1))} refund requests.`);
  await conn.end();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
