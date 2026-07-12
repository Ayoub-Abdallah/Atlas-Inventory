import { syncProductStockFromVariants } from '../../utils/stock';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const body = await readBody(event);

  const id = generateId('prod');
  const hasVariants = body.variants && Array.isArray(body.variants) && body.variants.length > 0;

  await db.insert(tables.products).values({
    id,
    name: body.name,
    sku: body.sku || null,
    barcode: body.barcode || null,
    description: body.description || null,
    slug: await uniqueProductSlug(body.name),
    brand: body.brand || null,
    specs: body.specs ?? null,
    relatedProducts: body.relatedProducts ?? null,
    published: body.published ?? false,
    publishedAt: body.published ? new Date() : null,
    categoryId: body.categoryId || null,
    costPrice: body.costPrice ?? 0,
    sellingPrice: body.sellingPrice ?? 0,
    marginPercent: body.marginPercent ?? 30,
    taxId: body.taxId || null,
    // If has variants, set initial stock to 0 (will be synced from variants)
    stockQuantity: hasVariants ? 0 : (body.stockQuantity ?? 0),
    stockMin: body.stockMin ?? 0,
    stockMax: body.stockMax || null,
    unit: body.unit || 'unit',
    supplierId: body.supplierId || null,
    isActive: true,
    options: body.options || null,
  });

  if (hasVariants) {
    const variantsToInsert = body.variants.map((v: any) => ({
      id: generateId('var'),
      productId: id,
      name: v.name,
      sku: v.sku || null,
      barcode: v.barcode || null,
      costPrice: v.costPrice ?? 0,
      marginPercent: v.marginPercent ?? 30,
      price: v.price ?? 0,
      taxId: v.taxId || null,
      stockQuantity: v.stockQuantity ?? 0,
      stockMin: v.stockMin ?? 0,
      stockMax: v.stockMax || null,
      supplierId: v.supplierId || null,
    }));
    await db.insert(tables.productVariants).values(variantsToInsert);

    // Sync parent product stock from variants
    await syncProductStockFromVariants(db, id);
  }

  return { id };
});
