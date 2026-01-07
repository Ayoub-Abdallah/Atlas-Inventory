-- Migration: Add sales tables
-- Date: 2026-01-07

-- Create sales table
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY NOT NULL,
  supplier_id TEXT REFERENCES suppliers(id),
  user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'draft',
  total_amount REAL NOT NULL DEFAULT 0,
  total_cost REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  notes TEXT,
  metadata TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- Create sale_items table
CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY NOT NULL,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  variant_id TEXT REFERENCES product_variants(id),
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  unit_cost REAL DEFAULT 0,
  tax_rate REAL DEFAULT 0,
  line_total REAL NOT NULL,
  created_at INTEGER
);

-- Add sale_id column to stock_movements if not exists
-- Note: SQLite doesn't support IF NOT EXISTS for columns, so we handle this in code

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_supplier_id ON sales(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);

-- Create index for barcode search optimization
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_product_variants_barcode ON product_variants(barcode);
