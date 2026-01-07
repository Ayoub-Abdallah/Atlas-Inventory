import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const saleId = getRouterParam(event, 'id');

  if (!saleId) {
    throw createError({
      statusCode: 400,
      message: 'Sale ID is required',
    });
  }

  // Get the sale
  const sale = await db.query.sales.findFirst({
    where: eq(tables.sales.id, saleId),
  });

  if (!sale) {
    throw createError({
      statusCode: 404,
      message: 'Sale not found',
    });
  }

  if (sale.status === 'confirmed') {
    throw createError({
      statusCode: 400,
      message: 'Cannot delete a confirmed sale',
    });
  }

  // Delete sale items first (cascade should handle this, but being explicit)
  await db.delete(tables.saleItems).where(eq(tables.saleItems.saleId, saleId));

  // Delete the sale
  await db.delete(tables.sales).where(eq(tables.sales.id, saleId));

  return { success: true, message: 'Sale deleted successfully' };
});
