import { eq, sql } from 'drizzle-orm';
import * as tables from '../database/schema';

/**
 * Syncs the parent product's stockQuantity to be the sum of all its variants' stockQuantity.
 * This should be called after any variant stock change to keep the parent product in sync.
 * 
 * For products without variants, this does nothing.
 */
export async function syncProductStockFromVariants(
  db: ReturnType<typeof useDB>,
  productId: string
): Promise<number> {
  // Get all variants for this product
  const variants = await db.query.productVariants.findMany({
    where: eq(tables.productVariants.productId, productId),
  });

  // If no variants, don't modify the product's stock (it's managed directly)
  if (variants.length === 0) {
    const product = await db.query.products.findFirst({
      where: eq(tables.products.id, productId),
    });
    return product?.stockQuantity ?? 0;
  }

  // Calculate total stock from all variants
  const totalStock = variants.reduce((sum, v) => sum + (v.stockQuantity ?? 0), 0);

  // Update the parent product's stockQuantity
  await db
    .update(tables.products)
    .set({
      stockQuantity: totalStock,
      updatedAt: new Date(),
    })
    .where(eq(tables.products.id, productId));

  return totalStock;
}

/**
 * Recalculates stock for ALL products that have variants.
 * Useful for data migration/repair.
 */
export async function syncAllProductStocks(
  db: ReturnType<typeof useDB>
): Promise<{ synced: number; products: { id: string; name: string; oldStock: number; newStock: number }[] }> {
  // Get all products that have variants
  const products = await db.query.products.findMany({
    with: {
      variants: true,
    },
  });

  const results: { id: string; name: string; oldStock: number; newStock: number }[] = [];

  for (const product of products) {
    if (product.variants && product.variants.length > 0) {
      const oldStock = product.stockQuantity ?? 0;
      const newStock = product.variants.reduce((sum, v) => sum + (v.stockQuantity ?? 0), 0);

      if (oldStock !== newStock) {
        await db
          .update(tables.products)
          .set({
            stockQuantity: newStock,
            updatedAt: new Date(),
          })
          .where(eq(tables.products.id, product.id));

        results.push({
          id: product.id,
          name: product.name,
          oldStock,
          newStock,
        });
      }
    }
  }

  return {
    synced: results.length,
    products: results,
  };
}

/**
 * Gets the effective stock for a product, considering variants.
 * If product has variants, returns sum of variant stocks.
 * Otherwise returns product's own stockQuantity.
 */
export async function getEffectiveStock(
  db: ReturnType<typeof useDB>,
  productId: string,
  variantId?: string | null
): Promise<{ stock: number; isVariant: boolean; variantName?: string }> {
  if (variantId) {
    const variant = await db.query.productVariants.findFirst({
      where: eq(tables.productVariants.id, variantId),
    });
    return {
      stock: variant?.stockQuantity ?? 0,
      isVariant: true,
      variantName: variant?.name,
    };
  }

  const product = await db.query.products.findFirst({
    where: eq(tables.products.id, productId),
    with: {
      variants: true,
    },
  });

  if (!product) {
    return { stock: 0, isVariant: false };
  }

  if (product.variants && product.variants.length > 0) {
    const totalStock = product.variants.reduce((sum, v) => sum + (v.stockQuantity ?? 0), 0);
    return { stock: totalStock, isVariant: false };
  }

  return { stock: product.stockQuantity ?? 0, isVariant: false };
}
