import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Zakat record ID is required',
    });
  }

  // Find the record
  const record = await db.query.zakatHistory.findFirst({
    where: eq(tables.zakatHistory.id, id),
  });

  if (!record) {
    throw createError({
      statusCode: 404,
      message: 'Zakat record not found',
    });
  }

  // Delete the record
  await db.delete(tables.zakatHistory).where(eq(tables.zakatHistory.id, id));

  return { success: true, message: 'Zakat record deleted' };
});
