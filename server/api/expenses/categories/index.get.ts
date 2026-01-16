import { desc } from 'drizzle-orm';

export default defineEventHandler(async () => {
  const db = useDB();

  const categories = await db.query.expenseCategories.findMany({
    orderBy: [desc(tables.expenseCategories.createdAt)],
  });

  return categories;
});
