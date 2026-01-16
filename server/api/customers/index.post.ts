export default defineEventHandler(async (event) => {
  const db = useDB();
  const body = await readBody(event);

  if (!body.name) {
    throw createError({
      statusCode: 400,
      message: 'Customer name is required',
    });
  }

  const id = generateId('cust');

  await db.insert(tables.customers).values({
    id,
    name: body.name,
    email: body.email || null,
    phone: body.phone || null,
    address: body.address || null,
    city: body.city || null,
    notes: body.notes || null,
    creditLimit: body.creditLimit || 0,
    currentBalance: 0,
    isActive: true,
  });

  return { id };
});
