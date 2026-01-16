import { desc } from 'drizzle-orm';

export default defineEventHandler(async () => {
  const db = useDB();

  const customers = await db.query.customers.findMany({
    orderBy: [desc(tables.customers.createdAt)],
  });

  return customers;
});
