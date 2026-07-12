import { eq } from 'drizzle-orm';
import { syncProductStockFromVariants } from '../../../utils/stock';

type OrderStatus = 'new' | 'confirmed' | 'delivered' | 'cancelled';

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

/**
 * Web order status flow. Stock is decremented when an order is confirmed
 * and restored when a confirmed (undelivered) order is cancelled.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!;
  const body = await readBody(event);
  const next = body?.status as OrderStatus;

  if (!['confirmed', 'delivered', 'cancelled'].includes(next)) {
    throw createError({ statusCode: 400, message: 'Invalid status' });
  }

  const db = useDB();
  const order = await db.query.webOrders.findFirst({
    where: eq(tables.webOrders.id, id),
    with: { items: { with: { product: true, variant: true } } },
  });
  if (!order) {
    throw createError({ statusCode: 404, message: 'Order not found' });
  }
  if (order.saleId) {
    throw createError({
      statusCode: 400,
      message: 'Order was converted to a sale; manage it from the sale instead',
    });
  }
  if (!TRANSITIONS[order.status as OrderStatus].includes(next)) {
    throw createError({
      statusCode: 400,
      message: `Cannot change status from ${order.status} to ${next}`,
    });
  }

  const productsToSync = new Set<string>();

  if (next === 'confirmed') {
    // Validate stock first so confirmation is all-or-nothing
    const insufficient: Array<{ productName: string; available: number; requested: number }> = [];
    for (const item of order.items) {
      const available = item.variant
        ? item.variant.stockQuantity || 0
        : item.product?.stockQuantity || 0;
      if (available < item.quantity) {
        insufficient.push({
          productName: item.variantName
            ? `${item.productName} - ${item.variantName}`
            : item.productName,
          available,
          requested: item.quantity,
        });
      }
    }
    if (insufficient.length > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: 'insufficient_stock',
        message: 'Insufficient stock for one or more items',
        data: { items: insufficient },
      });
    }

    for (const item of order.items) {
      if (item.variant) {
        const stockBefore = item.variant.stockQuantity || 0;
        const stockAfter = stockBefore - item.quantity;
        await db
          .update(tables.productVariants)
          .set({ stockQuantity: stockAfter, updatedAt: new Date() })
          .where(eq(tables.productVariants.id, item.variant.id));
        productsToSync.add(item.productId);
        await db.insert(tables.stockMovements).values({
          id: generateId('mov'),
          productId: item.productId,
          variantId: item.variant.id,
          type: 'out',
          quantity: -item.quantity,
          stockBefore,
          stockAfter,
          reference: order.orderNumber,
          reason: 'Web order confirmed',
        });
      } else if (item.product) {
        const stockBefore = item.product.stockQuantity || 0;
        const stockAfter = stockBefore - item.quantity;
        await db
          .update(tables.products)
          .set({ stockQuantity: stockAfter, updatedAt: new Date() })
          .where(eq(tables.products.id, item.productId));
        await db.insert(tables.stockMovements).values({
          id: generateId('mov'),
          productId: item.productId,
          variantId: null,
          type: 'out',
          quantity: -item.quantity,
          stockBefore,
          stockAfter,
          reference: order.orderNumber,
          reason: 'Web order confirmed',
        });
      }
    }
  }

  if (next === 'cancelled' && order.status === 'confirmed') {
    // Return reserved goods to stock
    for (const item of order.items) {
      if (item.variant) {
        const stockBefore = item.variant.stockQuantity || 0;
        const stockAfter = stockBefore + item.quantity;
        await db
          .update(tables.productVariants)
          .set({ stockQuantity: stockAfter, updatedAt: new Date() })
          .where(eq(tables.productVariants.id, item.variant.id));
        productsToSync.add(item.productId);
        await db.insert(tables.stockMovements).values({
          id: generateId('mov'),
          productId: item.productId,
          variantId: item.variant.id,
          type: 'return',
          quantity: item.quantity,
          stockBefore,
          stockAfter,
          reference: order.orderNumber,
          reason: 'Web order cancelled',
        });
      } else if (item.product) {
        const stockBefore = item.product.stockQuantity || 0;
        const stockAfter = stockBefore + item.quantity;
        await db
          .update(tables.products)
          .set({ stockQuantity: stockAfter, updatedAt: new Date() })
          .where(eq(tables.products.id, item.productId));
        await db.insert(tables.stockMovements).values({
          id: generateId('mov'),
          productId: item.productId,
          variantId: null,
          type: 'return',
          quantity: item.quantity,
          stockBefore,
          stockAfter,
          reference: order.orderNumber,
          reason: 'Web order cancelled',
        });
      }
    }
  }

  for (const productId of productsToSync) {
    await syncProductStockFromVariants(db, productId);
  }

  await db
    .update(tables.webOrders)
    .set({
      status: next,
      confirmedAt: next === 'confirmed' ? new Date() : order.confirmedAt,
      deliveredAt: next === 'delivered' ? new Date() : order.deliveredAt,
      cancelledAt: next === 'cancelled' ? new Date() : order.cancelledAt,
      updatedAt: new Date(),
    })
    .where(eq(tables.webOrders.id, id));

  return { success: true, status: next };
});
