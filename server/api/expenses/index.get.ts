import { desc, gte, lte, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);
  
  // Parse date filters
  const startDate = query.startDate ? new Date(query.startDate as string) : null;
  const endDate = query.endDate ? new Date(query.endDate as string) : null;

  // Build where conditions
  const conditions = [];
  if (startDate) {
    conditions.push(gte(tables.expenses.date, startDate));
  }
  if (endDate) {
    conditions.push(lte(tables.expenses.date, endDate));
  }

  const expenses = await db.query.expenses.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(tables.expenses.date)],
    with: {
      category: true,
      createdByUser: true,
    },
  });

  return expenses;
});
