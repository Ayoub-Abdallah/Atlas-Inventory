import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Customer ID is required',
    });
  }

  // Check if customer has any sales
  const customerSales = await db.query.sales.findFirst({
    where: eq(tables.sales.customerId, id),
  });

  if (customerSales) {
    throw createError({
      statusCode: 400,
      message: 'Cannot delete customer with existing sales. Deactivate instead.',
    });
  }

  await db.delete(tables.customers).where(eq(tables.customers.id, id));

  return { success: true };
});
