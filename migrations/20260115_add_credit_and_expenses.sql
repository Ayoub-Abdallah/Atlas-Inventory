-- Migration: Add Credit/Partial Payment and Expenses Features
-- Date: 2026-01-15

-- ============================================================================
-- CUSTOMERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  notes TEXT,
  credit_limit REAL DEFAULT 0,
  current_balance REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER
);

-- ============================================================================
-- PAYMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id),
  amount REAL NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  reference TEXT,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at INTEGER
);

-- ============================================================================
-- EXPENSE CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6B7280',
  is_active INTEGER DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER
);

-- ============================================================================
-- EXPENSES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES expense_categories(id),
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  date INTEGER NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  reference TEXT,
  notes TEXT,
  is_recurring INTEGER DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at INTEGER,
  updated_at INTEGER
);

-- ============================================================================
-- ADD NEW COLUMNS TO SALES TABLE
-- ============================================================================
-- Add customer_id column
ALTER TABLE sales ADD COLUMN customer_id TEXT REFERENCES customers(id);

-- Add payment_status column (unpaid, partial, paid)
ALTER TABLE sales ADD COLUMN payment_status TEXT DEFAULT 'unpaid';

-- Add paid_amount column
ALTER TABLE sales ADD COLUMN paid_amount REAL DEFAULT 0;

-- Add due_date column
ALTER TABLE sales ADD COLUMN due_date INTEGER;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);

CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);
