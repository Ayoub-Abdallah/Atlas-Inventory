import { desc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);

  const payments = await db.query.payments.findMany({
    orderBy: [desc(tables.payments.createdAt)],
    with: {
      sale: true,
      customer: true,
      createdByUser: true,
    },
  });

  return payments;
});
