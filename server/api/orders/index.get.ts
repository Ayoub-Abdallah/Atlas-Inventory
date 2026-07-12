import { desc, eq, sql } from 'drizzle-orm';

/** Admin list of storefront orders with status counts for the sidebar badge. */
export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);
  const status = typeof query.status === 'string' ? query.status : '';

  const orders = await db.query.webOrders.findMany({
    where: status
      ? eq(tables.webOrders.status, status as 'new' | 'confirmed' | 'delivered' | 'cancelled')
      : undefined,
    with: { items: true, customer: true },
    orderBy: [desc(tables.webOrders.createdAt)],
    limit: 200,
  });

  const countRows = await db
    .select({
      status: tables.webOrders.status,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(tables.webOrders)
    .groupBy(tables.webOrders.status);

  const counts: Record<string, number> = {
    new: 0,
    confirmed: 0,
    delivered: 0,
    cancelled: 0,
  };
  for (const row of countRows) counts[row.status] = row.count;

  return { orders, counts };
});
