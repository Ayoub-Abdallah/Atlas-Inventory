import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Reparation ID is required',
    });
  }

  // Check if reparation exists
  const reparation = await db.query.reparations.findFirst({
    where: eq(tables.reparations.id, id),
  });

  if (!reparation) {
    throw createError({
      statusCode: 404,
      message: 'Reparation not found',
    });
  }

  // Prevent deletion of completed reparations (for audit purposes)
  if (reparation.status === 'completed' && reparation.closedAt) {
    throw createError({
      statusCode: 400,
      message: 'Cannot delete completed reparations. Cancel it instead.',
    });
  }

  // Delete reparation (items will cascade delete)
  await db.delete(tables.reparations).where(eq(tables.reparations.id, id));

  return { success: true };
});
