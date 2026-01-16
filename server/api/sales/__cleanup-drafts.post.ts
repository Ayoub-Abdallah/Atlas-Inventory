import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();

  // Get all draft sales
  const draftSales = await db.query.sales.findMany({
    where: eq(tables.sales.status, 'draft'),
  });

  let deletedCount = 0;

  for (const sale of draftSales) {
    // Delete sale items first
    await db.delete(tables.saleItems).where(eq(tables.saleItems.saleId, sale.id));
    // Delete the sale
    await db.delete(tables.sales).where(eq(tables.sales.id, sale.id));
    deletedCount++;
  }

  return { 
    success: true, 
    message: `Deleted ${deletedCount} draft sales`,
    deletedCount 
  };
});
