import { eq, desc, and, ne } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Customer ID is required',
    });
  }

  const customer = await db.query.customers.findFirst({
    where: eq(tables.customers.id, id),
  });

  if (!customer) {
    throw createError({
      statusCode: 404,
      message: 'Customer not found',
    });
  }

  // Get all sales for this customer with payment status
  const sales = await db.query.sales.findMany({
    where: and(
      eq(tables.sales.customerId, id),
      eq(tables.sales.status, 'confirmed'),
      ne(tables.sales.paymentStatus, 'paid')
    ),
    orderBy: [desc(tables.sales.createdAt)],
    with: {
      items: {
        with: {
          product: true,
        },
      },
    },
  });

  // Get all payments for this customer
  const payments = await db.query.payments.findMany({
    where: eq(tables.payments.customerId, id),
    orderBy: [desc(tables.payments.createdAt)],
  });

  // Calculate totals
  const totalOutstanding = sales.reduce(
    (sum, sale) => sum + (sale.totalAmount - (sale.paidAmount || 0)),
    0
  );

  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return {
    customer,
    sales,
    payments,
    summary: {
      totalOutstanding,
      totalPaid,
      salesCount: sales.length,
    },
  };
});
