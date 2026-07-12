import { and, eq } from 'drizzle-orm';

/** Body: { orderedIds: string[] } — new gallery order, first item is the cover. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!;
  const body = await readBody(event);
  const orderedIds: string[] = Array.isArray(body?.orderedIds) ? body.orderedIds : [];
  if (orderedIds.length === 0) {
    throw createError({ statusCode: 400, message: 'orderedIds is required' });
  }

  const db = useDB();
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(tables.mediaAssets)
      .set({ sortOrder: i })
      .where(
        and(
          eq(tables.mediaAssets.id, orderedIds[i]!),
          eq(tables.mediaAssets.productId, id)
        )
      );
  }

  return { success: true };
});
