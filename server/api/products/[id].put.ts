import { eq } from 'drizzle-orm';
import { syncProductStockFromVariants } from '../../utils/stock';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  if (!id) {
    throw createError({ statusCode: 400, message: 'Product ID is required' });
  }

  // Get existing variants to preserve stock quantities if not explicitly provided
  const existingVariants = await db.query.productVariants.findMany({
    where: eq(tables.productVariants.productId, id),
  });
  const existingVariantMap = new Map(existingVariants.map(v => [v.id, v]));

  // Update the product (but don't update stockQuantity directly if it has variants)
  const hasVariants = body.variants && Array.isArray(body.variants) && body.variants.length > 0;

  // Storefront fields: keep the slug stable unless the product had none
  const current = await db.query.products.findFirst({
    where: eq(tables.products.id, id),
    columns: { slug: true, published: true },
  });
  const slug = current?.slug || (await uniqueProductSlug(body.name, id));
  const published = body.published ?? current?.published ?? false;

  await db
    .update(tables.products)
    .set({
      name: body.name,
      sku: body.sku || null,
      barcode: body.barcode || null,
      description: body.description || null,
      slug,
      brand: body.brand || null,
      specs: body.specs ?? null,
      relatedProducts: body.relatedProducts ?? null,
      published,
      publishedAt: published && !current?.published ? new Date() : undefined,
      categoryId: body.categoryId || null,
      costPrice: body.costPrice ?? 0,
      sellingPrice: body.sellingPrice ?? 0,
      marginPercent: body.marginPercent ?? 30,
      taxId: body.taxId || null,
      // Only update stockQuantity directly if no variants
      stockQuantity: hasVariants ? undefined : (body.stockQuantity ?? 0),
      stockMin: body.stockMin ?? 0,
      stockMax: body.stockMax || null,
      unit: body.unit || 'unit',
      supplierId: body.supplierId || null,
      options: body.options || null,
      updatedAt: new Date(),
    })
    .where(eq(tables.products.id, id));

  // Handle variants with upsert logic to preserve stock
  if (hasVariants) {
    const incomingVariantIds = new Set(body.variants.filter((v: any) => v.id).map((v: any) => v.id));
    
    // Delete variants that are no longer in the list
    for (const existingVariant of existingVariants) {
      if (!incomingVariantIds.has(existingVariant.id)) {
        await db.delete(tables.productVariants)
          .where(eq(tables.productVariants.id, existingVariant.id));
      }
    }

    // Upsert variants
    for (const v of body.variants) {
      const existingVariant = v.id ? existingVariantMap.get(v.id) : null;
      
      if (existingVariant) {
        // Update existing variant - preserve stock if not explicitly provided
        await db.update(tables.productVariants)
          .set({
            name: v.name,
            sku: v.sku || null,
            barcode: v.barcode || null,
            costPrice: v.costPrice ?? existingVariant.costPrice ?? 0,
            marginPercent: v.marginPercent ?? existingVariant.marginPercent ?? 30,
            price: v.price ?? existingVariant.price ?? 0,
            taxId: v.taxId || null,
            // Preserve existing stock unless explicitly provided
            stockQuantity: v.stockQuantity !== undefined ? v.stockQuantity : existingVariant.stockQuantity,
            stockMin: v.stockMin ?? existingVariant.stockMin ?? 0,
            stockMax: v.stockMax || existingVariant.stockMax || null,
            supplierId: v.supplierId || null,
            updatedAt: new Date(),
          })
          .where(eq(tables.productVariants.id, existingVariant.id));
      } else {
        // Insert new variant
        await db.insert(tables.productVariants).values({
          id: v.id || generateId('var'),
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
        });
      }
    }

    // Sync parent product stock from variants
    await syncProductStockFromVariants(db, id);
  } else {
    // No variants - delete any existing variants
    await db.delete(tables.productVariants)
      .where(eq(tables.productVariants.productId, id));
  }

  return { success: true };
});
