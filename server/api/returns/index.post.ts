import { eq } from 'drizzle-orm';
import { generateId } from '../../utils/id';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const body = await readBody(event);

  if (!body.saleId) {
    throw createError({ statusCode: 400, message: 'saleId is required' });
  }

  const sale = await db.query.sales.findFirst({ where: eq(tables.sales.id, body.saleId), with: { items: true } });
  if (!sale) throw createError({ statusCode: 404, message: 'Sale not found' });

  const id = generateId('ret');
  const now = new Date();

  // Insert return master record
  await db.insert(tables.saleReturns).values({
    id,
    saleId: body.saleId,
    userId: event.context?.user?.id || null,
    type: body.type || 'partial',
    reason: body.reason || null,
    totalAmount: 0,
    totalCost: 0,
    refundedAmount: 0,
    restocked: body.restock !== false,
    status: 'pending',
    createdAt: now,
  });

  // Insert items
  let totalAmount = 0;
  let totalCost = 0;

  if (Array.isArray(body.items)) {
    for (const it of body.items) {
      const saleItem = it.saleItemId ? await db.query.saleItems.findFirst({ where: eq(tables.saleItems.id, it.saleItemId) }) : null;
      const unitPrice = saleItem?.unitPrice ?? it.unitPrice ?? 0;
      const unitCost = saleItem?.unitCost ?? it.unitCost ?? 0;
      const lineTotal = (it.quantity || 0) * unitPrice;

      await db.insert(tables.saleReturnItems).values({
        id: generateId('sri'),
        returnId: id,
        saleItemId: it.saleItemId || null,
        productId: it.productId,
        variantId: it.variantId || null,
        quantity: it.quantity,
        unitPrice,
        unitCost,
        lineTotal,
        restocked: it.restock !== false,
        createdAt: now,
      });

      totalAmount += lineTotal;
      totalCost += (it.quantity || 0) * unitCost;
    }
  }

  // Update totals
  await db.update(tables.saleReturns).set({ totalAmount, totalCost }).where(eq(tables.saleReturns.id, id));

  // Optionally process immediately
  if (body.processNow) {
    // Call internal process handler by delegating to process endpoint logic inline for atomicity
    // We'll reuse the process logic by making a direct function call to the process handler module if present.
    // For now, mark pending and return id; caller should call /api/returns/:id/process or include processNow to process via separate request.
  }

  return { id, totalAmount, totalCost, status: 'pending' };
});
