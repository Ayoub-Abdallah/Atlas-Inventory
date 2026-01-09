// Migration endpoint to create database tables
export default defineEventHandler(async () => {
  const db = hubDatabase();
  
  // Create all tables
  const migrations = [
    // Taxes
    `CREATE TABLE IF NOT EXISTS taxes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rate REAL NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    )`,
    
    // Categories
    `CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      parent_id TEXT,
      color TEXT DEFAULT '#6B7280',
      created_at INTEGER,
      updated_at INTEGER,
      FOREIGN KEY (parent_id) REFERENCES categories(id)
    )`,
    
    // Suppliers
    `CREATE TABLE IF NOT EXISTS suppliers (
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
    )`,
    
    // Users
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      is_active INTEGER DEFAULT 1,
      created_at INTEGER,
      updated_at INTEGER
    )`,
    
    // Products
    `CREATE TABLE IF NOT EXISTS products (
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
    )`,
    
    // Product Variants
    `CREATE TABLE IF NOT EXISTS product_variants (
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
    )`,
    
    // Supplier Prices
    `CREATE TABLE IF NOT EXISTS supplier_prices (
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
    )`,
    
    // Supplier Price History
    `CREATE TABLE IF NOT EXISTS supplier_price_history (
      id TEXT PRIMARY KEY,
      supplier_price_id TEXT NOT NULL,
      price REAL NOT NULL,
      created_at INTEGER,
      created_by TEXT,
      FOREIGN KEY (supplier_price_id) REFERENCES supplier_prices(id) ON DELETE CASCADE
    )`,
    
    // Variant Supplier Exclusions
    `CREATE TABLE IF NOT EXISTS variant_supplier_exclusions (
      id TEXT PRIMARY KEY,
      variant_id TEXT NOT NULL,
      supplier_price_id TEXT NOT NULL,
      created_at INTEGER,
      FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
      FOREIGN KEY (supplier_price_id) REFERENCES supplier_prices(id) ON DELETE CASCADE
    )`,
    
    // Selling Price History
    `CREATE TABLE IF NOT EXISTS selling_price_history (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      price REAL NOT NULL,
      created_at INTEGER,
      created_by TEXT,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
    )`,
    
    // Stock Movements
    `CREATE TABLE IF NOT EXISTS stock_movements (
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
    )`,
    
    // Sales
    `CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      invoice_number TEXT,
      supplier_id TEXT,
      user_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      total_amount REAL NOT NULL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      client_name TEXT,
      client_info TEXT,
      notes TEXT,
      metadata TEXT,
      confirmed_at INTEGER,
      created_at INTEGER,
      updated_at INTEGER,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    
    // Sale Items
    `CREATE TABLE IF NOT EXISTS sale_items (
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
    )`,
    
    // Settings
    `CREATE TABLE IF NOT EXISTS settings (
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
    )`,
    
    // Zakat Settings
    `CREATE TABLE IF NOT EXISTS zakat_settings (
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
    )`,
    
    // Zakat History
    `CREATE TABLE IF NOT EXISTS zakat_history (
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
    )`,
  ];
  
  // Run each migration
  for (const sql of migrations) {
    await db.prepare(sql).run();
  }
  
  // Insert default settings
  await db.prepare(`INSERT OR IGNORE INTO settings (id) VALUES (1)`).run();
  await db.prepare(`INSERT OR IGNORE INTO zakat_settings (id) VALUES (1)`).run();
  
  return {
    success: true,
    message: 'Database migrations completed successfully',
    tables: migrations.length,
  };
});
