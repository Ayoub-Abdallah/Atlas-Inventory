import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!;
  const db = useDB();

  const order = await db.query.webOrders.findFirst({
    where: eq(tables.webOrders.id, id),
    with: {
      items: { with: { product: true, variant: true } },
      customer: true,
      sale: true,
    },
  });
  if (!order) {
    throw createError({ statusCode: 404, message: 'Order not found' });
  }

  return order;
});
