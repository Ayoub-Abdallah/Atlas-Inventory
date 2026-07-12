import { eq } from 'drizzle-orm';

/**
 * Public order confirmation lookup by order number. Returns only what the
 * customer already knows (their name and items), never the phone number.
 */
export default defineEventHandler(async (event) => {
  const number = getRouterParam(event, 'number')!;
  const db = useDB();

  const order = await db.query.webOrders.findFirst({
    where: eq(tables.webOrders.orderNumber, number),
    with: { items: true },
  });
  if (!order) {
    throw createError({ statusCode: 404, message: 'Order not found' });
  }

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    customerName: order.customerName,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    items: order.items.map((i) => ({
      productName: i.productName,
      variantName: i.variantName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    })),
  };
});
