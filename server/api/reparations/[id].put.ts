import { eq } from 'drizzle-orm';
import { generateId } from '../../utils/id';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const params = getRouterParams(event);
  const id = params.id;
  if (!id) throw createError({ statusCode: 400, message: 'Reparation id required' });
  const body = await readBody(event);

  const updates: any = {};
  if (body.status) updates.status = body.status;
  if (body.diagnosis) updates.diagnosis = body.diagnosis;
  if (body.repairNotes) updates.repairNotes = body.repairNotes;
  if (typeof body.laborCost !== 'undefined') updates.laborCost = body.laborCost;
  if (typeof body.partsCost !== 'undefined') updates.partsCost = body.partsCost;
  if (typeof body.price !== 'undefined') updates.price = body.price;
  updates.updatedAt = new Date();

  await db.update(tables.reparations).set(updates).where(eq(tables.reparations.id, id));

  // Add or update items if provided
  if (Array.isArray(body.items)) {
    const now = Math.floor(Date.now() / 1000);
    for (const it of body.items) {
      if (it.id) {
        // update existing
        await db.update(tables.reparationItems).set({
          quantity: it.quantity,
          unitCost: it.unitCost,
          lineTotal: (it.unitCost || 0) * (it.quantity || 0),
        }).where(eq(tables.reparationItems.id, it.id));
      } else {
        await db.insert(tables.reparationItems).values({
          id: generateId('rit'),
          reparationId: id,
          productId: it.productId || null,
          variantId: it.variantId || null,
          quantity: it.quantity || 1,
          unitCost: it.unitCost || null,
          lineTotal: (it.unitCost || 0) * (it.quantity || 1),
          createdAt: now,
        });
      }
    }
  }

  // Recompute partsCost and totalCost from items
  try {
    const items = await db.query.reparationItems.findMany({ where: eq(tables.reparationItems.reparationId, id) });
    const partsCost = items.reduce((s, it) => s + ((it.unitCost || 0) * (it.quantity || 0)), 0);
    const rep = await db.query.reparations.findFirst({ where: eq(tables.reparations.id, id) });
    const labor = rep?.laborCost || 0;
    const totalCost = partsCost + labor;
    await db.update(tables.reparations).set({ partsCost, totalCost, updatedAt: new Date() }).where(eq(tables.reparations.id, id));
  } catch (e) {
    console.error('Error recomputing reparation totals', e);
  }

  return { id };
});
