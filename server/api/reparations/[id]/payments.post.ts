import { eq } from 'drizzle-orm';
import { generateId } from '../../../utils/id';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const params = getRouterParams(event);
  const id = params.id;
  const body = await readBody(event);
  if (!id) throw createError({ statusCode: 400, message: 'Reparation id required' });
  if (!body.amount || body.amount <= 0) throw createError({ statusCode: 400, message: 'Valid payment amount is required' });

  const rep = await db.query.reparations.findFirst({ where: eq(tables.reparations.id, id) });
  if (!rep) throw createError({ statusCode: 404, message: 'Reparation not found' });

  const paymentId = generateId('pay');
  const now = Math.floor(Date.now() / 1000);

  await db.insert(tables.payments).values({
    id: paymentId,
    saleId: null,
    customerId: rep.customerId || null,
    amount: body.amount,
    paymentMethod: body.paymentMethod || 'cash',
    reference: body.reference || null,
    notes: body.notes || null,
    createdBy: body.createdBy || null,
    createdAt: now,
    reparationId: id,
  });

  const newPaid = (rep.paidAmount || 0) + body.amount;
  const price = rep.price || 0;
  const newStatus = newPaid >= price - 0.01 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');
  await db.update(tables.reparations).set({ paidAmount: newPaid, paymentStatus: newStatus }).where(eq(tables.reparations.id, id));

  // Update customer balance
  if (rep.customerId) {
    const customer = await db.query.customers.findFirst({ where: eq(tables.customers.id, rep.customerId) });
    if (customer) {
      const newBal = (customer.currentBalance || 0) - body.amount;
      await db.update(tables.customers).set({ currentBalance: Math.max(0, newBal), updatedAt: new Date() }).where(eq(tables.customers.id, rep.customerId));
    }
  }

  return { id: paymentId, newPaidAmount: newPaid, newPaymentStatus: newStatus };
});
