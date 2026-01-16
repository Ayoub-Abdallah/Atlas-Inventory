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

  const customer = await db.query.customers.findFirst({
    where: eq(tables.customers.id, id),
  });

  if (!customer) {
    throw createError({
      statusCode: 404,
      message: 'Customer not found',
    });
  }

  return customer;
});
