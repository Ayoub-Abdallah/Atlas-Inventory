-- Storefront: product publishing fields, media assets, web orders.
-- Run once against remote D1 (wrangler d1 execute). The /api/__migrate
-- endpoint applies the same changes idempotently for local/dev databases.

ALTER TABLE categories ADD COLUMN slug TEXT;
ALTER TABLE products ADD COLUMN slug TEXT;
ALTER TABLE products ADD COLUMN brand TEXT;
ALTER TABLE products ADD COLUMN specs TEXT;
ALTER TABLE products ADD COLUMN related_products TEXT;
ALTER TABLE products ADD COLUMN published INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN published_at INTEGER;

ALTER TABLE settings ADD COLUMN site_url TEXT;
ALTER TABLE settings ADD COLUMN phone_country_code TEXT DEFAULT '+213';
ALTER TABLE settings ADD COLUMN store_phone TEXT;
ALTER TABLE settings ADD COLUMN store_address TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'image',
  pathname TEXT NOT NULL,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  alt TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_media_assets_product ON media_assets(product_id);

CREATE TABLE IF NOT EXISTS web_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  total_amount REAL NOT NULL DEFAULT 0,
  sale_id TEXT,
  customer_id TEXT,
  confirmed_at INTEGER,
  delivered_at INTEGER,
  cancelled_at INTEGER,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS web_order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  product_name TEXT NOT NULL,
  variant_name TEXT,
  unit_price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  line_total REAL NOT NULL,
  created_at INTEGER,
  FOREIGN KEY (order_id) REFERENCES web_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (variant_id) REFERENCES product_variants(id)
);
CREATE INDEX IF NOT EXISTS idx_web_order_items_order ON web_order_items(order_id);
