// Adds the product_listings table (Add New Product drafts) to an existing database.
// Usage: node db/migrate-product-listings.js   (fresh installs get it from npm run db:setup)
require('dotenv').config({ quiet: true });
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'yoovic_seller',
  });
  await conn.query(`CREATE TABLE IF NOT EXISTS product_listings (
    id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    seller_id         INT UNSIGNED NOT NULL,
    status            ENUM('draft','submitted') NOT NULL DEFAULT 'draft',
    fulfillment_type  ENUM('fbm','fby') NULL,
    name_en           VARCHAR(255) NULL,
    sku               VARCHAR(100) NULL,
    data              LONGTEXT     NOT NULL COMMENT 'Full form state as JSON',
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_listings_seller_status (seller_id, status),
    CONSTRAINT fk_listings_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log('product_listings table is ready.');
  await conn.end();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
