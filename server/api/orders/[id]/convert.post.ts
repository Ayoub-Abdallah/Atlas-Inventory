import { eq } from 'drizzle-orm';

/**
 * Convert a confirmed web order into a sale so it enters the existing
 * sales/partial-payment flow (installments, invoices, customer balance).
 *
 * The order must be confirmed first: stock was already decremented at
 * confirmation, so the sale is created directly in "confirmed" state
 * without touching stock again. The customer is matched by phone or
 * created, and the unpaid amount goes onto their balance exactly like a
 * credit sale.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!;
  const session = await getUserSession(event);
  const db = useDB();

  const order = await db.query.webOrders.findFirst({
    where: eq(tables.webOrders.id, id),
    with: { items: { with: { product: true, variant: true } } },
  });
  if (!order) {
    throw createError({ statusCode: 404, message: 'Order not found' });
  }
  if (order.saleId) {
    throw createError({ statusCode: 400, message: 'Order was already converted to a sale' });
  }
  if (order.status !== 'confirmed' && order.status !== 'delivered') {
    throw createError({
      statusCode: 400,
      message: 'Confirm the order before converting it to a sale',
    });
  }

  // Find the customer by phone, or create one from the order contact
  let customer = await db.query.customers.findFirst({
    where: eq(tables.customers.phone, order.phone),
  });
  if (!customer) {
    const customerId = generateId('cust');
    await db.insert(tables.customers).values({
      id: customerId,
      name: order.customerName,
      phone: order.phone,
      notes: 'Created from web order',
    });
    customer = await db.query.customers.findFirst({
      where: eq(tables.customers.id, customerId),
    });
  }

  // Create the sale in confirmed state (stock already moved by the order)
  const saleId = generateId('sale');
  let totalCost = 0;
  for (const item of order.items) {
    const unitCost = item.variant?.costPrice ?? item.product?.costPrice ?? 0;
    totalCost += unitCost * item.quantity;
  }

  await db.insert(tables.sales).values({
    id: saleId,
    userId: session.user?.id || null,
    customerId: customer!.id,
    status: 'confirmed',
    paymentStatus: 'unpaid',
    totalAmount: order.totalAmount,
    totalCost,
    paidAmount: 0,
    clientName: order.customerName,
    clientInfo: order.phone,
    notes: order.note
      ? `Web order ${order.orderNumber}: ${order.note}`
      : `Web order ${order.orderNumber}`,
    metadata: { webOrderId: order.id, webOrderNumber: order.orderNumber },
    confirmedAt: new Date(),
  });

  for (const item of order.items) {
    await db.insert(tables.saleItems).values({
      id: generateId('sitem'),
      saleId,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost: item.variant?.costPrice ?? item.product?.costPrice ?? 0,
      lineTotal: item.lineTotal,
    });
  }

  // Unpaid total goes on the customer balance, matching the credit-sale flow
  await db
    .update(tables.customers)
    .set({
      currentBalance: (customer!.currentBalance || 0) + order.totalAmount,
      updatedAt: new Date(),
    })
    .where(eq(tables.customers.id, customer!.id));

  await db
    .update(tables.webOrders)
    .set({
      saleId,
      customerId: customer!.id,
      updatedAt: new Date(),
    })
    .where(eq(tables.webOrders.id, id));

  return { success: true, saleId, customerId: customer!.id };
});
