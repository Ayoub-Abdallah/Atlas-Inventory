export default defineEventHandler(async (event) => {
  const db = useDB();
  const body = await readBody(event);

  if (!body.name) {
    throw createError({
      statusCode: 400,
      message: 'Category name is required',
    });
  }

  const id = generateId('expcat');

  await db.insert(tables.expenseCategories).values({
    id,
    name: body.name,
    description: body.description || null,
    color: body.color || '#6B7280',
    isActive: true,
  });

  return { id };
});
