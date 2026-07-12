import { asc, eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!;
  const db = useDB();

  return db.query.mediaAssets.findMany({
    where: eq(tables.mediaAssets.productId, id),
    orderBy: [asc(tables.mediaAssets.sortOrder), asc(tables.mediaAssets.createdAt)],
  });
});
