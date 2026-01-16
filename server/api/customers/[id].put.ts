import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Customer ID is required',
    });
  }

  await db
    .update(tables.customers)
    .set({
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      city: body.city || null,
      notes: body.notes || null,
      creditLimit: body.creditLimit,
      isActive: body.isActive,
      updatedAt: new Date(),
    })
    .where(eq(tables.customers.id, id));

  return { success: true };
});
