import { eq } from 'drizzle-orm';
import { syncProductStockFromVariants } from '../../utils/stock';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const body = await readBody(event);

  if (!body.productId) {
    throw createError({ statusCode: 400, message: 'Product ID is required' });
  }

  // Check if we're working with a variant or the product directly
  const variantId = body.variantId || null;
  let currentStock: number;
  let entityType: 'variant' | 'product';
  let unitCost: number;

  if (variantId) {
    // Working with a variant
    const variant = await db.query.productVariants.findFirst({
      where: eq(tables.productVariants.id, variantId),
    });

    if (!variant) {
      throw createError({ statusCode: 404, message: 'Variant not found' });
    }

    if (variant.productId !== body.productId) {
      throw createError({ statusCode: 400, message: 'Variant does not belong to this product' });
    }

    currentStock = variant.stockQuantity ?? 0;
    unitCost = variant.costPrice ?? 0;
    entityType = 'variant';
  } else {
    // Working with the product directly (no variant)
    const product = await db.query.products.findFirst({
      where: eq(tables.products.id, body.productId),
      with: { variants: true },
    });

    if (!product) {
      throw createError({ statusCode: 404, message: 'Product not found' });
    }

    // If product has variants, require a variant to be specified
    if (product.variants && product.variants.length > 0) {
      throw createError({
        statusCode: 400,
        message: 'This product has variants. Please specify a variant ID.',
      });
    }

    currentStock = product.stockQuantity ?? 0;
    unitCost = product.costPrice ?? 0;
    entityType = 'product';
  }

  // Calculate the quantity change
  let quantity = body.quantity;

  if (body.type === 'out') {
    quantity = -Math.abs(quantity);
  } else if (body.type === 'adjustment') {
    // For adjustments, quantity is the absolute target, so calculate delta
    quantity = body.quantity - currentStock;
  }

  const newStock = currentStock + quantity;

  if (newStock < 0) {
    throw createError({
      statusCode: 400,
      message: `Insufficient stock. Current: ${currentStock}, Requested: ${Math.abs(body.quantity)}`,
    });
  }

  const id = generateId('mov');

  // Create the stock movement record
  await db.insert(tables.stockMovements).values({
    id,
    productId: body.productId,
    variantId: variantId,
    type: body.type,
    quantity: body.type === 'adjustment' ? quantity : body.quantity * (body.type === 'out' ? -1 : 1),
    stockBefore: currentStock,
    stockAfter: newStock,
    unitCost,
    reference: body.reference || null,
    reason: body.reason || null,
    supplierId: body.supplierId || null,
  });

  // Update the stock on the correct entity
  if (entityType === 'variant') {
    await db
      .update(tables.productVariants)
      .set({
        stockQuantity: newStock,
        updatedAt: new Date(),
      })
      .where(eq(tables.productVariants.id, variantId));

    // Sync the parent product's total stock from all variants
    await syncProductStockFromVariants(db, body.productId);
  } else {
    await db
      .update(tables.products)
      .set({
        stockQuantity: newStock,
        updatedAt: new Date(),
      })
      .where(eq(tables.products.id, body.productId));
  }

  return { id, newStock, variantId };
});
