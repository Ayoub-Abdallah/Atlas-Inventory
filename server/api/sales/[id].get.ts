import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const saleId = getRouterParam(event, 'id');

  if (!saleId) {
    throw createError({
      statusCode: 400,
      message: 'Sale ID is required',
    });
  }

  const sale = await db.query.sales.findFirst({
    where: eq(tables.sales.id, saleId),
    with: {
      supplier: true,
      user: true,
      items: {
        with: {
          product: true,
          variant: true,
        },
      },
    },
  });

  if (!sale) {
    throw createError({
      statusCode: 404,
      message: 'Sale not found',
    });
  }

  return sale;
});
