import { desc, eq } from 'drizzle-orm';

export default defineEventHandler(async () => {
  const db = useDB();

  const salesList = await db.query.sales.findMany({
    orderBy: [desc(tables.sales.createdAt)],
    with: {
      supplier: true,
      user: true,
      items: {
        with: {
          product: true,
          variant: true,
        },
      },
    },
  });

  return salesList;
});
