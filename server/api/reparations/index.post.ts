import { generateId } from '../../utils/id';

// Allowed payment methods — must match the payments schema enum
const VALID_PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'mobile', 'check', 'other'] as const;
type PaymentMethod = typeof VALID_PAYMENT_METHODS[number];

export default defineEventHandler(async (event) => {
  const db = useDB();

  // ── 1. Read & guard body ──────────────────────────────────────────────
  let body: any;
  try {
    body = await readBody(event);
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid or missing request body' });
  }

  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: 'Request body must be a JSON object' });
  }

  // ── 2. Validate required fields ───────────────────────────────────────
  const reportedIssue = (body.reportedIssue || '').toString().trim();
  if (!reportedIssue) {
    throw createError({ statusCode: 400, message: 'Reported issue is required' });
  }

  // ── 3. Validate items ─────────────────────────────────────────────────
  const items: Array<{ productId: string | null; variantId: string | null; quantity: number; unitCost: number }> = [];

  if (Array.isArray(body.items)) {
    for (const item of body.items) {
      const qty = Number(item.quantity) || 0;
      const cost = Number(item.unitCost) || 0;

      if (qty <= 0) {
        throw createError({ statusCode: 400, message: 'Item quantity must be greater than 0' });
      }
      if (cost < 0) {
        throw createError({ statusCode: 400, message: 'Item unit cost cannot be negative' });
      }

      items.push({
        productId: item.productId || null,
        variantId: item.variantId || null,
        quantity: qty,
        unitCost: cost,
      });
    }
  }

  // ── 4. Sanitise payment method ────────────────────────────────────────
  let paymentMethod: PaymentMethod = 'cash';
  if (body.paymentMethod) {
    const raw = String(body.paymentMethod).toLowerCase().replace(/_money$/, '');
    paymentMethod = VALID_PAYMENT_METHODS.includes(raw as PaymentMethod)
      ? (raw as PaymentMethod)
      : 'cash';
  }

  // ── 5. Server-authoritative cost calculations ─────────────────────────
  const partsCost = items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
  const laborCost = Math.max(0, parseFloat(body.laborCost) || 0);
  const totalCost = partsCost + laborCost;
  const depositAmount = Math.max(0, parseFloat(body.depositAmount) || 0);
  const price = Math.max(0, parseFloat(body.price) || 0);
  const paidAmount = depositAmount;

  // ── 5b. Draft vs confirmed ──────────────────────────────────────────
  const isDraft = body.status === 'draft';

  let paymentStatus = 'unpaid';
  if (!isDraft) {
    if (paidAmount > 0 && paidAmount >= price) paymentStatus = 'paid';
    else if (paidAmount > 0) paymentStatus = 'partial';
  }

  const id = generateId('rep');
  const now = new Date();

  console.log('[reparations/POST] Creating reparation', {
    id, reportedIssue, partsCost, laborCost, totalCost,
    depositAmount, price, paidAmount, paymentStatus, paymentMethod,
    itemCount: items.length,
  });

  // ── 6. Persist (sequential inserts — D1 does not support transactions) ──
  try {
    // Insert reparation
    await db.insert(tables.reparations).values({
      id,
      customerId: body.customerId || null,
      productId: body.productId || null,
      variantId: body.variantId || null,
      supplierId: body.supplierId || null,
      status: isDraft ? 'draft' : 'received',
      reportedIssue,
      diagnosis: (body.diagnosis || '').toString().trim() || null,
      repairNotes: (body.repairNotes || '').toString().trim() || null,
      partsCost,
      laborCost,
      totalCost,
      depositAmount,
      isWarranty: !!body.isWarranty,
      price,
      paidAmount,
      paymentStatus,
      createdAt: now,
      updatedAt: now,
      handledBy: body.handledBy || null,
    });

    // Insert items
    for (const item of items) {
      await db.insert(tables.reparationItems).values({
        id: generateId('rit'),
        reparationId: id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        lineTotal: item.quantity * item.unitCost,
        createdAt: now,
      });
    }

    // Record deposit payment if provided (skip for drafts)
    if (depositAmount > 0 && !isDraft) {
      await db.insert(tables.payments).values({
        id: generateId('pay'),
        reparationId: id,
        amount: depositAmount,
        paymentMethod,
        reference: `Deposit for ${id}`,
        createdAt: now,
      });
    }
  } catch (err: any) {
    console.error('[reparations/POST] DB insert failed:', err);
    throw createError({
      statusCode: 500,
      message: `Failed to create reparation: ${err?.message || 'Unknown database error'}`,
    });
  }

  console.log('[reparations/POST] Success — id:', id);
  setResponseStatus(event, 201);
  return { id };
});
