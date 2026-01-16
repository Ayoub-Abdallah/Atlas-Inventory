export default defineEventHandler(async (event) => {
  const db = useDB();
  const body = await readBody(event);

  if (!body.description) {
    throw createError({
      statusCode: 400,
      message: 'Expense description is required',
    });
  }

  if (!body.amount || body.amount <= 0) {
    throw createError({
      statusCode: 400,
      message: 'Valid expense amount is required',
    });
  }

  if (!body.date) {
    throw createError({
      statusCode: 400,
      message: 'Expense date is required',
    });
  }

  const id = generateId('exp');

  await db.insert(tables.expenses).values({
    id,
    categoryId: body.categoryId || null,
    description: body.description,
    amount: body.amount,
    date: new Date(body.date),
    paymentMethod: body.paymentMethod || 'cash',
    reference: body.reference || null,
    notes: body.notes || null,
    isRecurring: body.isRecurring || false,
    createdBy: body.createdBy || null,
  });

  return { id };
});
