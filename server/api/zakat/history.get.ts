import { desc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);

  // Optional filters
  const limit = query.limit ? parseInt(query.limit as string) : 50;

  // Fetch zakat history records, most recent first
  const history = await db.query.zakatHistory.findMany({
    orderBy: [desc(tables.zakatHistory.zakatDate)],
    limit,
  });

  return history;
});
