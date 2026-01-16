#!/usr/bin/env node
// Standalone script to initialize the SQLite database with all tables

import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get database paths
const dataDir = join(__dirname, '.data', 'hub', 'd1');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Check for Miniflare database (used by NuxtHub in dev mode)
const miniflareDir = join(dataDir, 'miniflare-D1DatabaseObject');
let dbPath;

if (existsSync(miniflareDir)) {
  const files = readdirSync(miniflareDir).filter(f => f.endsWith('.sqlite'));
  if (files.length > 0) {
    dbPath = join(miniflareDir, files[0]);
    console.log(`[Init] Found Miniflare database: ${dbPath}`);
  }
}

if (!dbPath) {
  dbPath = join(dataDir, 'default.sqlite');
  console.log(`[Init] Using default database: ${dbPath}`);
}

console.log(`[Init] Database path: ${dbPath}`);

// Create database connection
const db = new Database(dbPath);

// Enable WAL mode
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF'); // Temporarily disable for migrations

console.log('[Init] Running migrations...');

// Create customers table first (needed for sales FK)
db.exec(`
  -- Customers (create early for FK references)
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
`);

// Create all other tables
db.exec(`
  -- Taxes
  CREATE TABLE IF NOT EXISTS taxes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rate REAL NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER
  );

  -- Categories
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    parent_id TEXT,
    color TEXT DEFAULT '#6B7280',
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (parent_id) REFERENCES categories(id)
  );

  -- Suppliers
  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'France',
    notes TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER
  );

  -- Users
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    is_active INTEGER DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER
  );

  -- Products
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT UNIQUE,
    barcode TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category_id TEXT,
    cost_price REAL DEFAULT 0,
    selling_price REAL DEFAULT 0,
    margin_percent REAL DEFAULT 30,
    tax_id TEXT,
    stock_quantity INTEGER DEFAULT 0,
    stock_min INTEGER DEFAULT 0,
    stock_max INTEGER,
    unit TEXT DEFAULT 'unit',
    supplier_id TEXT,
    is_active INTEGER DEFAULT 1,
    options TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (tax_id) REFERENCES taxes(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

  -- Product Variants
  CREATE TABLE IF NOT EXISTS product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sku TEXT,
    barcode TEXT,
    cost_price REAL DEFAULT 0 NOT NULL,
    margin_percent REAL DEFAULT 30,
    price REAL DEFAULT 0 NOT NULL,
    tax_id TEXT,
    stock_quantity INTEGER DEFAULT 0,
    stock_min INTEGER DEFAULT 0,
    stock_max INTEGER,
    supplier_id TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (tax_id) REFERENCES taxes(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

  -- Supplier Prices
  CREATE TABLE IF NOT EXISTS supplier_prices (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    price REAL NOT NULL,
    min_quantity INTEGER DEFAULT 1,
    lead_time_days INTEGER,
    supplier_sku TEXT,
    purchase_url TEXT,
    is_preferred INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
  );

  -- Supplier Price History
  CREATE TABLE IF NOT EXISTS supplier_price_history (
    id TEXT PRIMARY KEY,
    supplier_price_id TEXT NOT NULL,
    price REAL NOT NULL,
    created_at INTEGER,
    created_by TEXT,
    FOREIGN KEY (supplier_price_id) REFERENCES supplier_prices(id) ON DELETE CASCADE
  );

  -- Variant Supplier Exclusions
  CREATE TABLE IF NOT EXISTS variant_supplier_exclusions (
    id TEXT PRIMARY KEY,
    variant_id TEXT NOT NULL,
    supplier_price_id TEXT NOT NULL,
    created_at INTEGER,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_price_id) REFERENCES supplier_prices(id) ON DELETE CASCADE
  );

  -- Selling Price History
  CREATE TABLE IF NOT EXISTS selling_price_history (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    variant_id TEXT,
    price REAL NOT NULL,
    created_at INTEGER,
    created_by TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
  );

  -- Stock Movements
  CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    variant_id TEXT,
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    stock_before INTEGER NOT NULL,
    stock_after INTEGER NOT NULL,
    unit_cost REAL,
    reference TEXT,
    reason TEXT,
    supplier_id TEXT,
    sale_id TEXT,
    created_at INTEGER,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

  -- Sales
  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    invoice_number TEXT,
    supplier_id TEXT,
    user_id TEXT,
    customer_id TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    total_amount REAL NOT NULL DEFAULT 0,
    total_cost REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    paid_amount REAL DEFAULT 0,
    due_date INTEGER,
    client_name TEXT,
    client_info TEXT,
    notes TEXT,
    metadata TEXT,
    confirmed_at INTEGER,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  -- Sale Items
  CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    variant_id TEXT,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    unit_cost REAL DEFAULT 0,
    tax_rate REAL DEFAULT 0,
    line_total REAL NOT NULL,
    created_at INTEGER,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id)
  );

  -- Settings
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY,
    business_name TEXT DEFAULT 'Atlas Inventory',
    currency TEXT DEFAULT 'EUR',
    language TEXT DEFAULT 'fr',
    theme TEXT DEFAULT 'default',
    default_margin REAL DEFAULT 30,
    low_stock_alert INTEGER DEFAULT 1,
    out_of_stock_alert INTEGER DEFAULT 1,
    email_daily_report INTEGER DEFAULT 0,
    invoice_template TEXT,
    invoice_prefix TEXT DEFAULT 'INV-',
    invoice_next_number INTEGER DEFAULT 1,
    updated_at INTEGER
  );

  -- Zakat Settings
  CREATE TABLE IF NOT EXISTS zakat_settings (
    id INTEGER PRIMARY KEY,
    nisab_gold_grams REAL DEFAULT 85,
    gold_price_per_gram REAL DEFAULT 0,
    nisab_value REAL DEFAULT 0,
    currency TEXT DEFAULT 'DZD',
    zakat_rate REAL DEFAULT 2.5,
    cash_balance REAL DEFAULT 0,
    receivables REAL DEFAULT 0,
    other_assets REAL DEFAULT 0,
    short_term_liabilities REAL DEFAULT 0,
    hawl_start_date INTEGER,
    last_calculated_at INTEGER,
    updated_at INTEGER
  );

  -- Zakat History
  CREATE TABLE IF NOT EXISTS zakat_history (
    id TEXT PRIMARY KEY,
    zakat_date INTEGER NOT NULL,
    inventory_value REAL DEFAULT 0,
    cash_balance REAL DEFAULT 0,
    receivables REAL DEFAULT 0,
    other_assets REAL DEFAULT 0,
    total_assets REAL NOT NULL,
    short_term_liabilities REAL DEFAULT 0,
    net_zakatable_assets REAL NOT NULL,
    nisab_at_time REAL NOT NULL,
    meets_nisab INTEGER DEFAULT 0,
    zakat_amount REAL NOT NULL,
    zakat_rate REAL DEFAULT 2.5,
    is_paid INTEGER DEFAULT 0,
    paid_at INTEGER,
    paid_amount REAL,
    payment_method TEXT,
    payment_reference TEXT,
    notes TEXT,
    currency TEXT DEFAULT 'DZD',
    created_at INTEGER,
    updated_at INTEGER
  );

  -- Customers (already created above, kept for reference)
  -- CREATE TABLE IF NOT EXISTS customers ...

  -- Payments
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL,
    customer_id TEXT,
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    reference TEXT,
    notes TEXT,
    created_by TEXT,
    created_at INTEGER,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  -- Expense Categories
  CREATE TABLE IF NOT EXISTS expense_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6B7280',
    is_active INTEGER DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER
  );

  -- Expenses
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    category_id TEXT,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    date INTEGER NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    reference TEXT,
    notes TEXT,
    is_recurring INTEGER DEFAULT 0,
    created_by TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (category_id) REFERENCES expense_categories(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  -- Insert default settings if not exists
  INSERT OR IGNORE INTO settings (id) VALUES (1);
  INSERT OR IGNORE INTO zakat_settings (id) VALUES (1);
`);

// Add missing columns to sales table if they don't exist
const addColumnIfNotExists = (tableName, columnName, columnDef) => {
  try {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const exists = columns.some(c => c.name === columnName);
    if (!exists) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
      console.log(`[Init] Added column ${columnName} to ${tableName}`);
    }
  } catch (e) {
    console.log(`[Init] Note: Could not add ${columnName} to ${tableName}: ${e.message}`);
  }
};

// Add missing columns to sales table
addColumnIfNotExists('sales', 'customer_id', 'TEXT');
addColumnIfNotExists('sales', 'payment_status', "TEXT DEFAULT 'paid'");
addColumnIfNotExists('sales', 'paid_amount', 'REAL DEFAULT 0');
addColumnIfNotExists('sales', 'due_date', 'INTEGER');

// Now create indexes (after columns exist)
const createIndexSafe = (sql) => {
  try {
    db.exec(sql);
  } catch (e) {
    // Index may already exist, ignore
  }
};

createIndexSafe('CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)');
createIndexSafe('CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)');
createIndexSafe('CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON payments(sale_id)');
createIndexSafe('CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id)');
createIndexSafe('CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id)');
createIndexSafe('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)');
createIndexSafe('CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id)');
createIndexSafe('CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status)');

// Re-enable foreign keys
db.pragma('foreign_keys = ON');

console.log('[Init] Migrations completed!');

// List tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('[Init] Created tables:', tables.map(t => t.name).join(', '));

db.close();
console.log('[Init] Database initialized successfully!');
