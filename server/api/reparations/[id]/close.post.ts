import { eq } from 'drizzle-orm';
import { syncProductStockFromVariants } from '../../../utils/stock';
import { generateId } from '../../../utils/id';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const params = getRouterParams(event);
  const body = await readBody(event);
  const id = params.id;
  if (!id) throw createError({ statusCode: 400, message: 'Reparation id required' });

  const rep = await db.query.reparations.findFirst({ where: eq(tables.reparations.id, id) });
  if (!rep) throw createError({ statusCode: 404, message: 'Reparation not found' });

  const items = await db.query.reparationItems.findMany({ where: eq(tables.reparationItems.reparationId, id) });
  const now = Math.floor(Date.now() / 1000);
  const stockMovementsCreated: string[] = [];

  // Consume parts: create stock movements type 'out' and update stock
  for (const it of items) {
    const qty = it.quantity || 0;
    if (qty <= 0) continue;

    // load current stock
    let currentStock = 0;
    if (it.variantId) {
      const variant = await db.query.productVariants.findFirst({ where: eq(tables.productVariants.id, it.variantId) });
      if (!variant) throw createError({ statusCode: 404, message: 'Variant not found' });
      currentStock = variant.stockQuantity ?? 0;
    } else {
      const product = await db.query.products.findFirst({ where: eq(tables.products.id, it.productId) });
      if (!product) throw createError({ statusCode: 404, message: 'Product not found' });
      currentStock = product.stockQuantity ?? 0;
    }

    if (currentStock < qty) {
      throw createError({ statusCode: 400, message: `Insufficient stock for product ${it.productId}` });
    }

    const newStock = currentStock - qty;
    const movId = generateId('mov');

    await db.insert(tables.stockMovements).values({
      id: movId,
      productId: it.productId,
      variantId: it.variantId || null,
      type: 'out',
      quantity: -qty,
      stockBefore: currentStock,
      stockAfter: newStock,
      unitCost: it.unitCost || null,
      reference: `REPAIR-${id}`,
      reason: 'Parts used for reparation',
      supplierId: null,
    });

    stockMovementsCreated.push(movId);

    if (it.variantId) {
      await db.update(tables.productVariants).set({ stockQuantity: newStock, updatedAt: new Date() }).where(eq(tables.productVariants.id, it.variantId));
      await syncProductStockFromVariants(db, it.productId);
    } else {
      await db.update(tables.products).set({ stockQuantity: newStock, updatedAt: new Date() }).where(eq(tables.products.id, it.productId));
    }
  }

  // Compute totals if missing
  const itemsRow = await db.query.reparationItems.findMany({ where: eq(tables.reparationItems.reparationId, id) });
  const partsCost = itemsRow.reduce((s, it) => s + ((it.unitCost || 0) * (it.quantity || 0)), 0);
  const labor = rep?.laborCost || 0;
  const totalCost = partsCost + labor;
  const price = body.price || rep?.price || Math.round((totalCost * 1.3) * 100) / 100; // default 30% markup

  // Update reparation record
  await db.update(tables.reparations).set({ partsCost, laborCost: labor, totalCost, price, status: 'repaired', closedAt: now }).where(eq(tables.reparations.id, id));

  let paymentId: string | null = null;
  if (body.payment && body.payment.amount && body.payment.amount > 0) {
    paymentId = generateId('pay');
    // insert into payments with reparationId
    await db.insert(tables.payments).values({
      id: paymentId,
      saleId: null,
      customerId: rep.customerId || null,
      amount: body.payment.amount,
      paymentMethod: body.payment.method || 'cash',
      reference: body.payment.reference || null,
      notes: body.payment.notes || null,
      createdBy: body.payment.createdBy || null,
      createdAt: now,
      reparationId: id,
    });

    // Update reparation paid amount and status
    const newPaid = (rep.paidAmount || 0) + body.payment.amount;
    const newStatus = newPaid >= price - 0.01 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');
    await db.update(tables.reparations).set({ paidAmount: newPaid, paymentStatus: newStatus }).where(eq(tables.reparations.id, id));

    // Update customer balance if exists
    if (rep.customerId) {
      const customer = await db.query.customers.findFirst({ where: eq(tables.customers.id, rep.customerId) });
      if (customer) {
        const newBal = (customer.currentBalance || 0) - body.payment.amount;
        await db.update(tables.customers).set({ currentBalance: Math.max(0, newBal), updatedAt: new Date() }).where(eq(tables.customers.id, rep.customerId));
      }
    }
  }

  return { id, closedAt: now, stockMovementsCreated, paymentId };
});
