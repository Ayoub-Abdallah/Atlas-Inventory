import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Expense ID is required',
    });
  }

  await db.delete(tables.expenses).where(eq(tables.expenses.id, id));

  return { success: true };
});
