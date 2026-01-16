import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Category ID is required',
    });
  }

  // Check if category has expenses
  const categoryExpenses = await db.query.expenses.findFirst({
    where: eq(tables.expenses.categoryId, id),
  });

  if (categoryExpenses) {
    throw createError({
      statusCode: 400,
      message: 'Cannot delete category with existing expenses. Deactivate instead.',
    });
  }

  await db.delete(tables.expenseCategories).where(eq(tables.expenseCategories.id, id));

  return { success: true };
});
