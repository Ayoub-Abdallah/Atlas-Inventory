import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Expense ID is required',
    });
  }

  await db
    .update(tables.expenses)
    .set({
      categoryId: body.categoryId || null,
      description: body.description,
      amount: body.amount,
      date: body.date ? new Date(body.date) : undefined,
      paymentMethod: body.paymentMethod,
      reference: body.reference || null,
      notes: body.notes || null,
      isRecurring: body.isRecurring,
      updatedAt: new Date(),
    })
    .where(eq(tables.expenses.id, id));

  return { success: true };
});
