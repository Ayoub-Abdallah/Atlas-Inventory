import { eq, sql, lte, desc } from 'drizzle-orm';

export default defineEventHandler(async () => {
  const db = useDB();

  const totalProductsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(tables.products)
    .where(eq(tables.products.isActive, true));
  const totalProducts = totalProductsResult[0]?.count ?? 0;

  const totalSuppliersResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(tables.suppliers)
    .where(eq(tables.suppliers.isActive, true));
  const totalSuppliers = totalSuppliersResult[0]?.count ?? 0;

  // Low stock detection - check both products (without variants) and variants
  // Products without variants that are low on stock
  const lowStockProductsWithoutVariants = await db
    .select()
    .from(tables.products)
    .where(
      sql`${tables.products.stockQuantity} <= ${tables.products.stockMin} 
          AND ${tables.products.isActive} = 1
          AND ${tables.products.id} NOT IN (
            SELECT DISTINCT product_id FROM product_variants
          )`
    )
    .limit(5);

  // Variants that are low on stock
  const lowStockVariants = await db
    .select({
      id: tables.productVariants.id,
      name: tables.productVariants.name,
      stockQuantity: tables.productVariants.stockQuantity,
      stockMin: tables.productVariants.stockMin,
      productId: tables.productVariants.productId,
      productName: tables.products.name,
    })
    .from(tables.productVariants)
    .innerJoin(tables.products, eq(tables.productVariants.productId, tables.products.id))
    .where(
      sql`${tables.productVariants.stockQuantity} <= ${tables.productVariants.stockMin}
          AND ${tables.products.isActive} = 1`
    )
    .limit(5);

  // Combine and format low stock items
  const lowStockProducts = [
    ...lowStockProductsWithoutVariants.map(p => ({
      id: p.id,
      name: p.name,
      stockQuantity: p.stockQuantity,
      stockMin: p.stockMin,
      isVariant: false,
    })),
    ...lowStockVariants.map(v => ({
      id: v.id,
      name: `${v.productName} - ${v.name}`,
      stockQuantity: v.stockQuantity,
      stockMin: v.stockMin,
      isVariant: true,
      productId: v.productId,
    })),
  ].slice(0, 5);

  const lowStockCount = lowStockProducts.length;

  // Stock value calculation - include both products (without variants) and variants
  // Products without variants
  const productStockValueResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(${tables.products.costPrice} * ${tables.products.stockQuantity}), 0)`,
    })
    .from(tables.products)
    .where(
      sql`${tables.products.isActive} = 1
          AND ${tables.products.id} NOT IN (
            SELECT DISTINCT product_id FROM product_variants
          )`
    );
  const productStockValue = productStockValueResult[0]?.total ?? 0;

  // Variants stock value
  const variantStockValueResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(${tables.productVariants.costPrice} * ${tables.productVariants.stockQuantity}), 0)`,
    })
    .from(tables.productVariants)
    .innerJoin(tables.products, eq(tables.productVariants.productId, tables.products.id))
    .where(eq(tables.products.isActive, true));
  const variantStockValue = variantStockValueResult[0]?.total ?? 0;

  const totalStockValue = Math.round((productStockValue + variantStockValue) * 100) / 100;

  const recentMovements = await db.query.stockMovements.findMany({
    limit: 5,
    orderBy: [desc(tables.stockMovements.createdAt)],
    with: {
      product: true,
      variant: true,
    },
  });

  return {
    totalProducts,
    totalSuppliers,
    lowStockCount,
    totalStockValue,
    lowStockProducts,
    recentMovements,
  };
});
