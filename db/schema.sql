-- Yoovic Seller Central schema (MySQL 5.7+ / MariaDB 10.3+)

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS fby_shipments;
DROP TABLE IF EXISTS barcodes;
DROP TABLE IF EXISTS product_listings;
DROP TABLE IF EXISTS refund_requests;
DROP TABLE IF EXISTS hero_backgrounds;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS payouts;
DROP TABLE IF EXISTS seller_finances;
DROP TABLE IF EXISTS customer_weekly_metrics;
DROP TABLE IF EXISTS store_daily_metrics;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS sellers;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE sellers (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  store_name    VARCHAR(120) NOT NULL,
  owner_name    VARCHAR(120) NOT NULL,
  country_name  VARCHAR(80)  NOT NULL,
  country_code  CHAR(2)      NOT NULL,
  avatar_url    VARCHAR(255) NULL,
  hero_background_id INT UNSIGNED NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE products (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  seller_id      INT UNSIGNED  NOT NULL,
  name           VARCHAR(160)  NOT NULL,
  sku            VARCHAR(40)   NOT NULL UNIQUE,
  price          DECIMAL(10,2) NOT NULL,
  stock          INT           NOT NULL DEFAULT 0,
  reorder_level  INT           NOT NULL DEFAULT 10,
  last_sold_at   DATETIME      NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_products_seller (seller_id),
  CONSTRAINT fk_products_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Amount columns: product + shipping + commission + discount + other = total_amount
CREATE TABLE orders (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  seller_id          INT UNSIGNED  NOT NULL,
  order_number       VARCHAR(20)   NOT NULL UNIQUE,
  status             ENUM('pending','confirmed','packaging','out_for_delivery','delivered','canceled','returned','failed_to_deliver') NOT NULL DEFAULT 'pending',
  product_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping_amount    DECIMAL(10,2) NOT NULL DEFAULT 0,
  commission_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount    DECIMAL(10,2) NOT NULL DEFAULT 0,
  other_amount       DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount       DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_profit         DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at         DATETIME      NOT NULL,
  KEY idx_orders_seller_date (seller_id, created_at),
  CONSTRAINT fk_orders_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE store_daily_metrics (
  seller_id            INT UNSIGNED  NOT NULL,
  metric_date          DATE          NOT NULL,
  visitors             INT           NOT NULL DEFAULT 0,
  ad_spend             DECIMAL(10,2) NOT NULL DEFAULT 0,
  ad_attributed_sales  DECIMAL(10,2) NOT NULL DEFAULT 0,
  ad_conversions       INT           NOT NULL DEFAULT 0,
  PRIMARY KEY (seller_id, metric_date),
  CONSTRAINT fk_metrics_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE customer_weekly_metrics (
  seller_id             INT UNSIGNED NOT NULL,
  week_start            DATE         NOT NULL,
  new_customers         INT          NOT NULL DEFAULT 0,
  repeat_customers      INT          NOT NULL DEFAULT 0,
  repeat_purchase_rate  DECIMAL(5,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (seller_id, week_start),
  CONSTRAINT fk_custmetrics_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE seller_finances (
  seller_id             INT UNSIGNED  NOT NULL PRIMARY KEY,
  withdrawable_balance  DECIMAL(12,2) NOT NULL DEFAULT 0,
  pending_withdraw      DECIMAL(12,2) NOT NULL DEFAULT 0,
  pending_clearance     DECIMAL(12,2) NOT NULL DEFAULT 0,
  already_withdrawn     DECIMAL(12,2) NOT NULL DEFAULT 0,
  commission_given      DECIMAL(12,2) NOT NULL DEFAULT 0,
  delivery_charges      DECIMAL(12,2) NOT NULL DEFAULT 0,
  vat_given             DECIMAL(12,2) NOT NULL DEFAULT 0,
  collected_cash        DECIMAL(12,2) NOT NULL DEFAULT 0,
  updated_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_finances_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cross-border payouts shown on the globe
CREATE TABLE payouts (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  seller_id     INT UNSIGNED  NOT NULL,
  city          VARCHAR(80)   NOT NULL,
  country_label VARCHAR(40)   NOT NULL,
  country_code  CHAR(2)       NOT NULL,
  amount        DECIMAL(10,2) NOT NULL,
  status        ENUM('credited','in_transit') NOT NULL DEFAULT 'credited',
  created_at    DATETIME      NOT NULL,
  KEY idx_payouts_seller_date (seller_id, created_at),
  CONSTRAINT fk_payouts_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notifications (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  seller_id   INT UNSIGNED NOT NULL,
  type        ENUM('order','stock','campaign','withdrawal','review') NOT NULL,
  message     VARCHAR(255) NOT NULL,
  is_read     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL,
  KEY idx_notifications_seller_date (seller_id, created_at),
  CONSTRAINT fk_notifications_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Product listings created with the Add New Product flow (also applied by db/migrate-product-listings.js)
CREATE TABLE product_listings (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Unique 12-digit barcode numbers (Code 128) for variations, boxes and master cartons
-- (also applied by db/migrate-fby-shipments.js)
CREATE TABLE barcodes (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  seller_id   INT UNSIGNED NOT NULL,
  listing_id  INT UNSIGNED NULL,
  kind        ENUM('variation','box','master') NOT NULL,
  code        CHAR(12)     NULL UNIQUE,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_barcodes_listing (listing_id),
  CONSTRAINT fk_barcodes_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE,
  CONSTRAINT fk_barcodes_listing FOREIGN KEY (listing_id) REFERENCES product_listings(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Submitted FBY shipments (FBY Page 3 → Submit)
CREATE TABLE fby_shipments (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Refund requests raised against orders
CREATE TABLE refund_requests (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Images available as the dashboard hero background. Built-in images (is_builtin = 1) cannot be deleted.
CREATE TABLE hero_backgrounds (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  seller_id   INT UNSIGNED NOT NULL,
  label       VARCHAR(120) NOT NULL,
  file_path   VARCHAR(255) NOT NULL,
  is_builtin  TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_hero_backgrounds_seller (seller_id),
  CONSTRAINT fk_hero_backgrounds_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE sellers
  ADD CONSTRAINT fk_sellers_hero_background FOREIGN KEY (hero_background_id) REFERENCES hero_backgrounds(id) ON DELETE SET NULL;
