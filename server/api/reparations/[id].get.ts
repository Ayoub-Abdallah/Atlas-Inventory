import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Reparation ID is required',
    });
  }

  const reparation = await db.query.reparations.findFirst({
    where: eq(tables.reparations.id, id),
    with: {
      customer: true,
      items: {
        with: {
          product: true,
          variant: true,
        },
      },
      handler: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!reparation) {
    throw createError({
      statusCode: 404,
      message: 'Reparation not found',
    });
  }

  // Get payment records for this reparation
  const payments = await db.query.payments.findMany({
    where: eq(tables.payments.reparationId, id),
    orderBy: (payments, { desc }) => [desc(payments.createdAt)],
  });

  return {
    ...reparation,
    payments,
  };
});
