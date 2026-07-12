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
    slug: text('slug'),
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
// SALE RETURNS
// ============================================================================
export const saleReturns = sqliteTable('sale_returns', {
  id: text('id').primaryKey(),
  saleId: text('sale_id').notNull().references(() => sales.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id),
  type: text('type').default('partial'),
  reason: text('reason'),
  totalAmount: real('total_amount').default(0),
  totalCost: real('total_cost').default(0),
  refundedAmount: real('refunded_amount').default(0),
  restocked: integer('restocked', { mode: 'boolean' }).default(1),
  status: text('status').default('processed'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  processedAt: integer('processed_at', { mode: 'timestamp' }),
});

export const saleReturnItems = sqliteTable('sale_return_items', {
  id: text('id').primaryKey(),
  returnId: text('return_id').notNull().references(() => saleReturns.id, { onDelete: 'cascade' }),
  saleItemId: text('sale_item_id').references(() => saleItems.id),
  productId: text('product_id').notNull().references(() => products.id),
  variantId: text('variant_id').references(() => productVariants.id),
  quantity: integer('quantity').notNull(),
  unitPrice: real('unit_price'),
  unitCost: real('unit_cost'),
  lineTotal: real('line_total'),
  restocked: integer('restocked', { mode: 'boolean' }).default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const refunds = sqliteTable('refunds', {
  id: text('id').primaryKey(),
  saleReturnId: text('sale_return_id').references(() => saleReturns.id),
  amount: real('amount').notNull(),
  paymentMethod: text('payment_method'),
  reference: text('reference'),
  createdBy: text('created_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================================================
// REPARATIONS
// ============================================================================
export const reparations = sqliteTable('reparations', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').references(() => customers.id),
  productId: text('product_id').references(() => products.id),
  variantId: text('variant_id').references(() => productVariants.id),
  supplierId: text('supplier_id').references(() => suppliers.id),
  status: text('status').default('received'),
  reportedIssue: text('reported_issue'),
  diagnosis: text('diagnosis'),
  repairNotes: text('repair_notes'),
  partsCost: real('parts_cost').default(0),
  laborCost: real('labor_cost').default(0),
  totalCost: real('total_cost').default(0),
  depositAmount: real('deposit_amount').default(0),
  isWarranty: integer('is_warranty', { mode: 'boolean' }).default(0),
  price: real('price').default(0),
  paidAmount: real('paid_amount').default(0),
  paymentStatus: text('payment_status').default('unpaid'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  returnedAt: integer('returned_at', { mode: 'timestamp' }),
  handledBy: text('handled_by').references(() => users.id),
  closedAt: integer('closed_at', { mode: 'timestamp' }),
});

export const reparationItems = sqliteTable('reparation_items', {
  id: text('id').primaryKey(),
  reparationId: text('reparation_id').notNull().references(() => reparations.id, { onDelete: 'cascade' }),
  productId: text('product_id').references(() => products.id),
  variantId: text('variant_id').references(() => productVariants.id),
  quantity: integer('quantity').notNull(),
  unitCost: real('unit_cost'),
  lineTotal: real('line_total'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const saleReturnsRelations = relations(saleReturns, ({ one, many }) => ({
  sale: one(sales, { fields: [saleReturns.saleId], references: [sales.id] }),
  user: one(users, { fields: [saleReturns.userId], references: [users.id] }),
  items: many(saleReturnItems),
}));

export const saleReturnItemsRelations = relations(saleReturnItems, ({ one }) => ({
  return: one(saleReturns, { fields: [saleReturnItems.returnId], references: [saleReturns.id] }),
  saleItem: one(saleItems, { fields: [saleReturnItems.saleItemId], references: [saleItems.id] }),
  product: one(products, { fields: [saleReturnItems.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [saleReturnItems.variantId], references: [productVariants.id] }),
}));

export const reparationRelations = relations(reparations, ({ one, many }) => ({
  customer: one(customers, { fields: [reparations.customerId], references: [customers.id] }),
  items: many(reparationItems),
  payments: many(payments),
  handler: one(users, { fields: [reparations.handledBy], references: [users.id] }),
}));

export const reparationItemsRelations = relations(reparationItems, ({ one }) => ({
  reparation: one(reparations, { fields: [reparationItems.reparationId], references: [reparations.id] }),
  product: one(products, { fields: [reparationItems.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [reparationItems.variantId], references: [productVariants.id] }),
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

  // Storefront fields
  slug: text('slug'),
  brand: text('brand'),
  specs: text('specs', { mode: 'json' }), // [{ key, value }]
  relatedProducts: text('related_products', { mode: 'json' }), // product ids, manual picks
  published: integer('published', { mode: 'boolean' }).default(false),
  publishedAt: integer('published_at', { mode: 'timestamp' }),

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
  media: many(mediaAssets),
}));

// ============================================================================
// MEDIA ASSETS
// Product gallery images and technical documents stored in Cloudflare R2
// (via NuxtHub blob: local disk in dev, R2 bucket in production).
// Only the object pathname is stored; files are served from /media/[pathname].
// ============================================================================
export const mediaAssets = sqliteTable('media_assets', {
  id: text('id').primaryKey(),
  productId: text('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['image', 'document'] })
    .notNull()
    .default('image'),
  pathname: text('pathname').notNull(), // blob object key
  url: text('url').notNull(), // public path, e.g. /media/products/xxx/file.webp
  filename: text('filename').notNull(),
  mimeType: text('mime_type'),
  size: integer('size'),
  alt: text('alt'),
  sortOrder: integer('sort_order').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
});

export const mediaAssetsRelations = relations(mediaAssets, ({ one }) => ({
  product: one(products, {
    fields: [mediaAssets.productId],
    references: [products.id],
  }),
}));

// ============================================================================
// WEB ORDERS
// Orders placed from the public storefront (no online payment).
// Flow: new -> confirmed (stock decremented) -> delivered, or cancelled.
// Can be converted to a sale to enter the existing partial-payment flow.
// ============================================================================
export const webOrders = sqliteTable('web_orders', {
  id: text('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  customerName: text('customer_name').notNull(),
  phone: text('phone').notNull(),
  note: text('note'),
  status: text('status', {
    enum: ['new', 'confirmed', 'delivered', 'cancelled'],
  })
    .notNull()
    .default('new'),
  totalAmount: real('total_amount').notNull().default(0),
  saleId: text('sale_id').references(() => sales.id),
  customerId: text('customer_id').references(() => customers.id),
  confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
  deliveredAt: integer('delivered_at', { mode: 'timestamp' }),
  cancelledAt: integer('cancelled_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
});

export const webOrderItems = sqliteTable('web_order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id')
    .notNull()
    .references(() => webOrders.id, { onDelete: 'cascade' }),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  variantId: text('variant_id').references(() => productVariants.id),
  // Name/price snapshots so the order stays readable if the product changes
  productName: text('product_name').notNull(),
  variantName: text('variant_name'),
  unitPrice: real('unit_price').notNull(),
  quantity: integer('quantity').notNull(),
  lineTotal: real('line_total').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
});

export const webOrdersRelations = relations(webOrders, ({ one, many }) => ({
  items: many(webOrderItems),
  sale: one(sales, { fields: [webOrders.saleId], references: [sales.id] }),
  customer: one(customers, {
    fields: [webOrders.customerId],
    references: [customers.id],
  }),
}));

export const webOrderItemsRelations = relations(webOrderItems, ({ one }) => ({
  order: one(webOrders, {
    fields: [webOrderItems.orderId],
    references: [webOrders.id],
  }),
  product: one(products, {
    fields: [webOrderItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [webOrderItems.variantId],
    references: [productVariants.id],
  }),
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
// CUSTOMERS
// ============================================================================
export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  notes: text('notes'),
  creditLimit: real('credit_limit').default(0), // 0 = no limit
  currentBalance: real('current_balance').default(0), // Outstanding balance
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
});

export const customersRelations = relations(customers, ({ many }) => ({
  sales: many(sales),
  payments: many(payments),
}));

// ============================================================================
// SALES
// ============================================================================
export const sales = sqliteTable('sales', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoice_number'),
  supplierId: text('supplier_id').references(() => suppliers.id),
  userId: text('user_id').references(() => users.id),
  customerId: text('customer_id').references(() => customers.id),
  status: text('status', { enum: ['draft', 'confirmed', 'cancelled'] })
    .notNull()
    .default('draft'),
  paymentStatus: text('payment_status', { enum: ['unpaid', 'partial', 'paid'] })
    .notNull()
    .default('unpaid'),
  totalAmount: real('total_amount').notNull().default(0),
  totalCost: real('total_cost').default(0),
  taxAmount: real('tax_amount').default(0),
  paidAmount: real('paid_amount').default(0),
  dueDate: integer('due_date', { mode: 'timestamp' }),
  // Client info (legacy, kept for backward compatibility)
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
  customer: one(customers, {
    fields: [sales.customerId],
    references: [customers.id],
  }),
  items: many(saleItems),
  returns: many(saleReturns),
  movements: many(stockMovements),
  payments: many(payments),
}));

// ============================================================================
// PAYMENTS
// ============================================================================
export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  saleId: text('sale_id')
    .references(() => sales.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').references(() => customers.id),
  reparationId: text('reparation_id').references(() => reparations.id),
  amount: real('amount').notNull(),
  paymentMethod: text('payment_method', { 
    enum: ['cash', 'card', 'bank_transfer', 'mobile', 'check', 'other'] 
  }).default('cash'),
  reference: text('reference'),
  notes: text('notes'),
  createdBy: text('created_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
});

export const paymentsRelations = relations(payments, ({ one }) => ({
  sale: one(sales, {
    fields: [payments.saleId],
    references: [sales.id],
  }),
  reparation: one(reparations, {
    fields: [payments.reparationId],
    references: [reparations.id],
  }),
  customer: one(customers, {
    fields: [payments.customerId],
    references: [customers.id],
  }),
  createdByUser: one(users, {
    fields: [payments.createdBy],
    references: [users.id],
  }),
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

export type SaleReturn = typeof saleReturns.$inferSelect;
export type NewSaleReturn = typeof saleReturns.$inferInsert;

export type SaleReturnItem = typeof saleReturnItems.$inferSelect;
export type NewSaleReturnItem = typeof saleReturnItems.$inferInsert;

export type Refund = typeof refunds.$inferSelect;
export type NewRefund = typeof refunds.$inferInsert;

export type Reparation = typeof reparations.$inferSelect;
export type NewReparation = typeof reparations.$inferInsert;

export type ReparationItem = typeof reparationItems.$inferSelect;
export type NewReparationItem = typeof reparationItems.$inferInsert;

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;

export type WebOrder = typeof webOrders.$inferSelect;
export type NewWebOrder = typeof webOrders.$inferInsert;

export type WebOrderItem = typeof webOrderItems.$inferSelect;
export type NewWebOrderItem = typeof webOrderItems.$inferInsert;

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
  // Storefront settings
  siteUrl: text('site_url'), // public base URL, e.g. https://shop.example.com
  phoneCountryCode: text('phone_country_code').default('+213'), // for wa.me links
  storePhone: text('store_phone'), // shop contact shown on the storefront
  storeAddress: text('store_address'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
});

export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;

// ============================================================================
// ZAKAT SETTINGS
// Stores configuration for Zakat calculation (Nisab threshold, gold price, etc.)
// ============================================================================
export const zakatSettings = sqliteTable('zakat_settings', {
  id: integer('id').primaryKey(), // Singleton pattern, always ID 1
  nisabGoldGrams: real('nisab_gold_grams').default(85), // Standard: 85 grams of gold
  goldPricePerGram: real('gold_price_per_gram').default(0), // Current gold price in currency
  nisabValue: real('nisab_value').default(0), // Calculated: goldPricePerGram * nisabGoldGrams
  currency: text('currency').default('DZD'),
  zakatRate: real('zakat_rate').default(2.5), // Standard: 2.5%
  // Manual adjustments for assets not tracked in inventory
  cashBalance: real('cash_balance').default(0),
  receivables: real('receivables').default(0),
  otherAssets: real('other_assets').default(0),
  shortTermLiabilities: real('short_term_liabilities').default(0),
  // Calculation period tracking (lunar year / Hawl)
  hawlStartDate: integer('hawl_start_date', { mode: 'timestamp' }),
  lastCalculatedAt: integer('last_calculated_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
});

export type ZakatSettings = typeof zakatSettings.$inferSelect;
export type NewZakatSettings = typeof zakatSettings.$inferInsert;

// ============================================================================
// ZAKAT HISTORY
// Records of Zakat calculations and payments over time
// ============================================================================
export const zakatHistory = sqliteTable('zakat_history', {
  id: text('id').primaryKey(),
  zakatDate: integer('zakat_date', { mode: 'timestamp' }).notNull(), // Date zakat was calculated/due
  // Asset breakdown at time of calculation
  inventoryValue: real('inventory_value').default(0), // Total inventory at selling price
  cashBalance: real('cash_balance').default(0),
  receivables: real('receivables').default(0),
  otherAssets: real('other_assets').default(0),
  totalAssets: real('total_assets').notNull(), // Sum of above
  // Liabilities
  shortTermLiabilities: real('short_term_liabilities').default(0),
  // Net calculation
  netZakatableAssets: real('net_zakatable_assets').notNull(), // totalAssets - liabilities
  nisabAtTime: real('nisab_at_time').notNull(), // Nisab threshold at calculation time
  meetsNisab: integer('meets_nisab', { mode: 'boolean' }).default(false),
  zakatAmount: real('zakat_amount').notNull(), // 2.5% if meets Nisab, else 0
  zakatRate: real('zakat_rate').default(2.5), // Rate used for calculation
  // Payment tracking
  isPaid: integer('is_paid', { mode: 'boolean' }).default(false),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  paidAmount: real('paid_amount'), // Actual amount paid (may differ)
  paymentMethod: text('payment_method'), // cash, bank, charity org, etc.
  paymentReference: text('payment_reference'), // Receipt number, etc.
  // Additional info
  notes: text('notes'),
  currency: text('currency').default('DZD'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
});

export type ZakatHistory = typeof zakatHistory.$inferSelect;
export type NewZakatHistory = typeof zakatHistory.$inferInsert;

// ============================================================================
// EXPENSE CATEGORIES
// ============================================================================
export const expenseCategories = sqliteTable('expense_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color').default('#6B7280'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
});

export const expenseCategoriesRelations = relations(expenseCategories, ({ many }) => ({
  expenses: many(expenses),
}));

// ============================================================================
// EXPENSES
// ============================================================================
export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').references(() => expenseCategories.id),
  description: text('description').notNull(),
  amount: real('amount').notNull(),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  paymentMethod: text('payment_method', { 
    enum: ['cash', 'card', 'bank_transfer', 'mobile', 'check', 'other'] 
  }).default('cash'),
  reference: text('reference'),
  notes: text('notes'),
  isRecurring: integer('is_recurring', { mode: 'boolean' }).default(false),
  createdBy: text('created_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
});

export const expensesRelations = relations(expenses, ({ one }) => ({
  category: one(expenseCategories, {
    fields: [expenses.categoryId],
    references: [expenseCategories.id],
  }),
  createdByUser: one(users, {
    fields: [expenses.createdBy],
    references: [users.id],
  }),
}));

export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type NewExpenseCategory = typeof expenseCategories.$inferInsert;

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
