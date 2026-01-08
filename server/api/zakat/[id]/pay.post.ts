import { eq } from 'drizzle-orm';

interface MarkPaidBody {
  paidAmount?: number;
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
}

export default defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, 'id');
  const body = await readBody<MarkPaidBody>(event);

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Zakat record ID is required',
    });
  }

  // Find the zakat record
  const record = await db.query.zakatHistory.findFirst({
    where: eq(tables.zakatHistory.id, id),
  });

  if (!record) {
    throw createError({
      statusCode: 404,
      message: 'Zakat record not found',
    });
  }

  if (record.isPaid) {
    throw createError({
      statusCode: 400,
      message: 'This Zakat record is already marked as paid',
    });
  }

  // Mark as paid
  await db
    .update(tables.zakatHistory)
    .set({
      isPaid: true,
      paidAt: new Date(),
      paidAmount: body.paidAmount ?? record.zakatAmount,
      paymentMethod: body.paymentMethod,
      paymentReference: body.paymentReference,
      notes: body.notes ?? record.notes,
      updatedAt: new Date(),
    })
    .where(eq(tables.zakatHistory.id, id));

  // Return updated record
  const updated = await db.query.zakatHistory.findFirst({
    where: eq(tables.zakatHistory.id, id),
  });

  return updated;
});
