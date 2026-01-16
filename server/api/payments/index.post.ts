import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const body = await readBody(event);

  // Validate required fields
  if (!body.saleId) {
    throw createError({
      statusCode: 400,
      message: 'Sale ID is required',
    });
  }

  if (!body.amount || body.amount <= 0) {
    throw createError({
      statusCode: 400,
      message: 'Valid payment amount is required',
    });
  }

  // Get the sale
  const sale = await db.query.sales.findFirst({
    where: eq(tables.sales.id, body.saleId),
  });

  if (!sale) {
    throw createError({
      statusCode: 404,
      message: 'Sale not found',
    });
  }

  if (sale.status !== 'confirmed') {
    throw createError({
      statusCode: 400,
      message: 'Can only add payments to confirmed sales',
    });
  }

  // Calculate remaining balance
  const currentPaid = sale.paidAmount || 0;
  const remaining = sale.totalAmount - currentPaid;

  if (body.amount > remaining + 0.01) { // Small tolerance for floating point
    throw createError({
      statusCode: 400,
      message: `Payment amount exceeds remaining balance of ${remaining.toFixed(2)}`,
    });
  }

  // Create the payment
  const paymentId = generateId('pay');
  const paymentAmount = Math.min(body.amount, remaining);
  const newPaidAmount = currentPaid + paymentAmount;

  // Determine new payment status
  let newPaymentStatus: 'unpaid' | 'partial' | 'paid' = 'partial';
  if (newPaidAmount >= sale.totalAmount - 0.01) {
    newPaymentStatus = 'paid';
  } else if (newPaidAmount <= 0) {
    newPaymentStatus = 'unpaid';
  }

  // Insert payment
  await db.insert(tables.payments).values({
    id: paymentId,
    saleId: body.saleId,
    customerId: sale.customerId,
    amount: paymentAmount,
    paymentMethod: body.paymentMethod || 'cash',
    reference: body.reference || null,
    notes: body.notes || null,
    createdBy: body.createdBy || null,
  });

  // Update sale paid amount and status
  await db
    .update(tables.sales)
    .set({
      paidAmount: newPaidAmount,
      paymentStatus: newPaymentStatus,
      updatedAt: new Date(),
    })
    .where(eq(tables.sales.id, body.saleId));

  // Update customer balance if customer exists
  if (sale.customerId) {
    const customer = await db.query.customers.findFirst({
      where: eq(tables.customers.id, sale.customerId),
    });

    if (customer) {
      const newBalance = (customer.currentBalance || 0) - paymentAmount;
      await db
        .update(tables.customers)
        .set({
          currentBalance: Math.max(0, newBalance),
          updatedAt: new Date(),
        })
        .where(eq(tables.customers.id, sale.customerId));
    }
  }

  return {
    id: paymentId,
    amount: paymentAmount,
    newPaidAmount,
    newPaymentStatus,
    remainingBalance: sale.totalAmount - newPaidAmount,
  };
});
