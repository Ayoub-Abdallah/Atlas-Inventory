import { eq, and, desc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const q = getQuery(event);

  const conditions: any[] = [];
  
  if (q.saleId) {
    conditions.push(eq(tables.saleReturns.saleId, q.saleId as string));
  }
  
  if (q.status) {
    conditions.push(eq(tables.saleReturns.status, q.status as string));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.query.saleReturns.findMany({
    where: whereClause,
    with: { 
      items: {
        with: {
          product: true,
          variant: true,
        },
      }, 
      sale: true 
    },
    orderBy: [desc(tables.saleReturns.createdAt)],
  });

  return rows;
});
