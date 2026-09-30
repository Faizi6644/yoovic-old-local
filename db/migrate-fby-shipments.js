// Adds the barcodes and fby_shipments tables (FBY Page 3) to an existing database.
// Usage: node db/migrate-fby-shipments.js   (fresh installs get them from npm run db:setup)
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
  await conn.query(`CREATE TABLE IF NOT EXISTS barcodes (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    seller_id   INT UNSIGNED NOT NULL,
    listing_id  INT UNSIGNED NULL,
    kind        ENUM('variation','box','master') NOT NULL,
    code        CHAR(12)     NULL UNIQUE,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_barcodes_listing (listing_id),
    CONSTRAINT fk_barcodes_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE,
    CONSTRAINT fk_barcodes_listing FOREIGN KEY (listing_id) REFERENCES product_listings(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await conn.query(`CREATE TABLE IF NOT EXISTS fby_shipments (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    seller_id      INT UNSIGNED  NOT NULL,
    listing_id     INT UNSIGNED  NOT NULL,
    shipment_code  VARCHAR(20)   NULL UNIQUE,
    status         ENUM('submitted','received','cancelled') NOT NULL DEFAULT 'submitted',
    warehouse_id   VARCHAR(40)   NOT NULL,
    total_units    INT UNSIGNED  NOT NULL,
    total_boxes    INT UNSIGNED  NOT NULL,
    shipping_method ENUM('self','yoovic') NOT NULL,
    carrier        VARCHAR(40)   NOT NULL,
    data           LONGTEXT      NOT NULL COMMENT 'Shipment snapshot as JSON',
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_shipments_seller (seller_id, created_at),
    CONSTRAINT fk_shipments_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE,
    CONSTRAINT fk_shipments_listing FOREIGN KEY (listing_id) REFERENCES product_listings(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log('barcodes and fby_shipments tables are ready.');
  await conn.end();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
