import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Category ID is required',
    });
  }

  await db
    .update(tables.expenseCategories)
    .set({
      name: body.name,
      description: body.description || null,
      color: body.color,
      isActive: body.isActive,
      updatedAt: new Date(),
    })
    .where(eq(tables.expenseCategories.id, id));

  return { success: true };
});
