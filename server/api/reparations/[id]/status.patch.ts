import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Reparation ID is required',
    });
  }

  const reparation = await db.query.reparations.findFirst({
    where: eq(tables.reparations.id, id),
  });

  if (!reparation) {
    throw createError({
      statusCode: 404,
      message: 'Reparation not found',
    });
  }

  const validStatuses = ['draft', 'received', 'diagnosed', 'in_progress', 'completed', 'returned', 'cancelled'];
  if (body.status && !validStatuses.includes(body.status)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid status value',
    });
  }

  const now = new Date();
  const updates: any = {
    updatedAt: now,
  };

  // Update status
  if (body.status) {
    updates.status = body.status;
    
    // Auto-set returnedAt when status becomes 'returned'
    if (body.status === 'returned' && !reparation.returnedAt) {
      updates.returnedAt = now;
    }
  }

  // Update other fields
  if (body.diagnosis !== undefined) updates.diagnosis = body.diagnosis;
  if (body.repairNotes !== undefined) updates.repairNotes = body.repairNotes;
  if (body.laborCost !== undefined) {
    updates.laborCost = parseFloat(body.laborCost) || 0;
    // Recalculate totalCost
    updates.totalCost = (reparation.partsCost || 0) + (parseFloat(body.laborCost) || 0);
  }
  if (body.price !== undefined) updates.price = parseFloat(body.price) || 0;

  await db.update(tables.reparations)
    .set(updates)
    .where(eq(tables.reparations.id, id));

  return { success: true };
});
