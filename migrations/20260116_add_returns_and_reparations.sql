-- Migration: 20260116_add_returns_and_reparations.sql
-- Adds sale_returns, sale_return_items, refunds, reparations and reparation_items

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS sale_returns (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  user_id TEXT,
  type TEXT NOT NULL DEFAULT 'partial', -- 'partial' | 'full'
  reason TEXT,
  total_amount REAL NOT NULL DEFAULT 0,
  total_cost REAL DEFAULT 0,
  refunded_amount REAL DEFAULT 0,
  restocked INTEGER DEFAULT 1, -- boolean: 1=true
  status TEXT DEFAULT 'processed', -- 'pending'|'processed'|'rejected'
  created_at INTEGER,
  processed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sale_returns_sale_id ON sale_returns(sale_id);

CREATE TABLE IF NOT EXISTS sale_return_items (
  id TEXT PRIMARY KEY,
  return_id TEXT NOT NULL,
  sale_item_id TEXT,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  quantity INTEGER NOT NULL,
  unit_price REAL,
  unit_cost REAL,
  line_total REAL,
  restocked INTEGER DEFAULT 1,
  created_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sale_return_items_return_id ON sale_return_items(return_id);

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  sale_return_id TEXT,
  amount REAL NOT NULL,
  payment_method TEXT,
  reference TEXT,
  created_by TEXT,
  created_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_refunds_sale_return_id ON refunds(sale_return_id);

-- Reparations (repair management)
CREATE TABLE IF NOT EXISTS reparations (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  product_id TEXT,
  variant_id TEXT,
  supplier_id TEXT,
  status TEXT DEFAULT 'received', -- 'received'|'in_progress'|'repaired'|'returned'|'cancelled'
  reported_issue TEXT,
  diagnosis TEXT,
  repair_notes TEXT,
  parts_cost REAL DEFAULT 0,
  labor_cost REAL DEFAULT 0,
  total_cost REAL DEFAULT 0,
  deposit_amount REAL DEFAULT 0,
  is_warranty INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER,
  returned_at INTEGER,
  handled_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_reparations_customer_id ON reparations(customer_id);

CREATE TABLE IF NOT EXISTS reparation_items (
  id TEXT PRIMARY KEY,
  reparation_id TEXT NOT NULL,
  product_id TEXT,
  variant_id TEXT,
  quantity INTEGER NOT NULL,
  unit_cost REAL,
  line_total REAL,
  created_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_reparation_items_reparation_id ON reparation_items(reparation_id);

-- Add nullable reparation_id to payments for linking repair payments
ALTER TABLE payments ADD COLUMN reparation_id TEXT;
CREATE INDEX IF NOT EXISTS idx_payments_reparation_id ON payments(reparation_id);

COMMIT;
