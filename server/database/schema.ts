import {
  sqliteTable,
  text,
  integer,
  real,
  foreignKey,
} from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// TAXES
// ============================================================================
export const taxes = sqliteTable('taxes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  rate: real('rate').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
});

// ============================================================================
// CATEGORIES
// ============================================================================
export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    parentId: text('parent_id'),
    color: text('color').default('#6B7280'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
      () => new Date()
    ),
  },
  (table) => ({
    parentFk: foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
    }),
  })
);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'parentChild',
  }),
  children: many(categories, { relationName: 'parentChild' }),
  products: many(products),
}));

// ============================================================================
// SUPPLIERS
// ============================================================================
export const suppliers = sqliteTable('suppliers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  postalCode: text('postal_code'),
  country: text('country').default('France'),
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
});

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  products: many(products),
  supplierPrices: many(supplierPrices),
  sales: many(sales),
}));

// ============================================================================
// PRODUCTS
// ============================================================================
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  sku: text('sku').unique(),
  barcode: text('barcode'),
  name: text('name').notNull(),
  description: text('description'),

  categoryId: text('category_id').references(() => categories.id),

  costPrice: real('cost_price').default(0),
  sellingPrice: real('selling_price').default(0),
  marginPercent: real('margin_percent').default(30),

  taxId: text('tax_id').references(() => taxes.id),

  stockQuantity: integer('stock_quantity').default(0),
  stockMin: integer('stock_min').default(0),
  stockMax: integer('stock_max'),

  unit: text('unit').default('unit'),

  supplierId: text('supplier_id').references(() => suppliers.id),

  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  options: text('options', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
});

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  tax: one(taxes, {
    fields: [products.taxId],
    references: [taxes.id],
  }),
  supplier: one(suppliers, {
    fields: [products.supplierId],
    references: [suppliers.id],
  }),
  supplierPrices: many(supplierPrices),
  stockMovements: many(stockMovements),
  variants: many(productVariants),
}));

// ============================================================================
// PRODUCT VARIANTS
// ============================================================================
export const productVariants = sqliteTable('product_variants', {
  id: text('id').primaryKey(),
  productId: text('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sku: text('sku'),
  barcode: text('barcode'),

  costPrice: real('cost_price').default(0).notNull(),
  marginPercent: real('margin_percent').default(30),
  price: real('price').default(0).notNull(),

  taxId: text('tax_id').references(() => taxes.id),

  stockQuantity: integer('stock_quantity').default(0),
  stockMin: integer('stock_min').default(0),
  stockMax: integer('stock_max'),

  supplierId: text('supplier_id').references(() => suppliers.id),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
});

export const productVariantsRelations = relations(
  productVariants,
  ({ one, many }) => ({
    product: one(products, {
      fields: [productVariants.productId],
      references: [products.id],
    }),
    supplier: one(suppliers, {
      fields: [productVariants.supplierId],
      references: [suppliers.id],
    }),
    tax: one(taxes, {
      fields: [productVariants.taxId],
      references: [taxes.id],
    }),
    stockMovements: many(stockMovements),
  })
);

// ============================================================================
// SUPPLIER PRICES (Supplier pricing for a product)
// ============================================================================
export const supplierPrices = sqliteTable('supplier_prices', {
  id: text('id').primaryKey(),
  productId: text('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  supplierId: text('supplier_id')
    .notNull()
    .references(() => suppliers.id, { onDelete: 'cascade' }),
  price: real('price').notNull(),
  minQuantity: integer('min_quantity').default(1),
  leadTimeDays: integer('lead_time_days'),
  supplierSku: text('supplier_sku'),
  purchaseUrl: text('purchase_url'),
  isPreferred: integer('is_preferred', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
});

// ============================================================================
// SUPPLIER PRICE HISTORY
// ============================================================================
export const supplierPriceHistory = sqliteTable('supplier_price_history', {
  id: text('id').primaryKey(),
  supplierPriceId: text('supplier_price_id')
    .notNull()
    .references(() => supplierPrices.id, { onDelete: 'cascade' }),
  price: real('price').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  createdBy: text('created_by'),
});

export const supplierPriceHistoryRelations = relations(
  supplierPriceHistory,
  ({ one }) => ({
    supplierPrice: one(supplierPrices, {
      fields: [supplierPriceHistory.supplierPriceId],
      references: [supplierPrices.id],
    }),
  })
);

export const supplierPricesRelations = relations(
  supplierPrices,
  ({ one, many }) => ({
    product: one(products, {
      fields: [supplierPrices.productId],
      references: [products.id],
    }),
    supplier: one(suppliers, {
      fields: [supplierPrices.supplierId],
      references: [suppliers.id],
    }),
    priceHistory: many(supplierPriceHistory),
    variantExclusions: many(variantSupplierExclusions),
  })
);

// ============================================================================
// VARIANT SUPPLIER EXCLUSIONS (to mark which variants are NOT available from which suppliers)
// By default, all variants are available from all product suppliers
// ============================================================================
export const variantSupplierExclusions = sqliteTable(
  'variant_supplier_exclusions',
  {
    id: text('id').primaryKey(),
    variantId: text('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    supplierPriceId: text('supplier_price_id')
      .notNull()
      .references(() => supplierPrices.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
      () => new Date()
    ),
  }
);

export const variantSupplierExclusionsRelations = relations(
  variantSupplierExclusions,
  ({ one }) => ({
    variant: one(productVariants, {
      fields: [variantSupplierExclusions.variantId],
      references: [productVariants.id],
    }),
    supplierPrice: one(supplierPrices, {
      fields: [variantSupplierExclusions.supplierPriceId],
      references: [supplierPrices.id],
    }),
  })
);

// ============================================================================
// SELLING PRICE HISTORY (to track product selling price changes over time)
// ============================================================================
export const sellingPriceHistory = sqliteTable('selling_price_history', {
  id: text('id').primaryKey(),
  productId: text('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  variantId: text('variant_id').references(() => productVariants.id, {
    onDelete: 'cascade',
  }),
  price: real('price').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  createdBy: text('created_by'),
});

export const sellingPriceHistoryRelations = relations(
  sellingPriceHistory,
  ({ one }) => ({
    product: one(products, {
      fields: [sellingPriceHistory.productId],
      references: [products.id],
    }),
    variant: one(productVariants, {
      fields: [sellingPriceHistory.variantId],
      references: [productVariants.id],
    }),
  })
);

// ============================================================================
// STOCK MOVEMENTS
// ============================================================================
export const stockMovements = sqliteTable('stock_movements', {
  id: text('id').primaryKey(),
  productId: text('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  variantId: text('variant_id').references(() => productVariants.id),

  type: text('type', {
    enum: ['in', 'out', 'adjustment', 'transfer', 'return', 'sale'],
  }).notNull(),

  quantity: integer('quantity').notNull(),

  stockBefore: integer('stock_before').notNull(),
  stockAfter: integer('stock_after').notNull(),

  unitCost: real('unit_cost'),

  reference: text('reference'),

  reason: text('reason'),

  supplierId: text('supplier_id').references(() => suppliers.id),

  saleId: text('sale_id'),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
});

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [stockMovements.variantId],
    references: [productVariants.id],
  }),
  supplier: one(suppliers, {
    fields: [stockMovements.supplierId],
    references: [suppliers.id],
  }),
  sale: one(sales, {
    fields: [stockMovements.saleId],
    references: [sales.id],
  }),
}));

// ============================================================================
// SALES
// ============================================================================
export const sales = sqliteTable('sales', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoice_number'),
  supplierId: text('supplier_id').references(() => suppliers.id),
  userId: text('user_id').references(() => users.id),
  status: text('status', { enum: ['draft', 'confirmed', 'cancelled'] })
    .notNull()
    .default('draft'),
  totalAmount: real('total_amount').notNull().default(0),
  totalCost: real('total_cost').default(0),
  taxAmount: real('tax_amount').default(0),
  // Client info
  clientName: text('client_name'),
  clientInfo: text('client_info'),
  notes: text('notes'),
  metadata: text('metadata', { mode: 'json' }),
  confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
});

export const salesRelations = relations(sales, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [sales.supplierId],
    references: [suppliers.id],
  }),
  user: one(users, {
    fields: [sales.userId],
    references: [users.id],
  }),
  items: many(saleItems),
  movements: many(stockMovements),
}));

// ============================================================================
// SALE ITEMS
// ============================================================================
export const saleItems = sqliteTable('sale_items', {
  id: text('id').primaryKey(),
  saleId: text('sale_id')
    .notNull()
    .references(() => sales.id, { onDelete: 'cascade' }),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  variantId: text('variant_id').references(() => productVariants.id),
  quantity: integer('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
  unitCost: real('unit_cost').default(0),
  taxRate: real('tax_rate').default(0),
  lineTotal: real('line_total').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
});

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [saleItems.variantId],
    references: [productVariants.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================
export type Tax = typeof taxes.$inferSelect;
export type NewTax = typeof taxes.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;

export type SupplierPrice = typeof supplierPrices.$inferSelect;
export type NewSupplierPrice = typeof supplierPrices.$inferInsert;

export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;

export type SupplierPriceHistory = typeof supplierPriceHistory.$inferSelect;
export type NewSupplierPriceHistory = typeof supplierPriceHistory.$inferInsert;

export type VariantSupplierExclusion =
  typeof variantSupplierExclusions.$inferSelect;
export type NewVariantSupplierExclusion =
  typeof variantSupplierExclusions.$inferInsert;

export type SellingPriceHistory = typeof sellingPriceHistory.$inferSelect;
export type NewSellingPriceHistory = typeof sellingPriceHistory.$inferInsert;

export type Sale = typeof sales.$inferSelect;
export type NewSale = typeof sales.$inferInsert;

export type SaleItem = typeof saleItems.$inferSelect;
export type NewSaleItem = typeof saleItems.$inferInsert;

// ============================================================================
// USERS
// Roles:
// - admin: Full access, can manage users
// - member: Full access to inventory (read/write), no user management
// - viewer: Read-only access to inventory, no modifications allowed
// ============================================================================
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'member', 'viewer'] })
    .notNull()
    .default('member'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ============================================================================
// SETTINGS
// ============================================================================
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  businessName: text('business_name').default('Atlas Inventory'),
  currency: text('currency').default('EUR'),
  language: text('language').default('fr'),
  theme: text('theme').default('default'),
  defaultMargin: real('default_margin').default(30),
  lowStockAlert: integer('low_stock_alert', { mode: 'boolean' }).default(true),
  outOfStockAlert: integer('out_of_stock_alert', { mode: 'boolean' }).default(
    true
  ),
  emailDailyReport: integer('email_daily_report', { mode: 'boolean' }).default(
    false
  ),
  invoiceTemplate: text('invoice_template'), // base64 encoded DOCX or null
  invoicePrefix: text('invoice_prefix').default('INV-'),
  invoiceNextNumber: integer('invoice_next_number').default(1),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
});

export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;
