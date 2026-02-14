import { eq } from 'drizzle-orm';
import { generateId } from '../../../utils/id';

// Allowed payment methods
const VALID_PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'mobile', 'check', 'other'] as const;
type PaymentMethod = typeof VALID_PAYMENT_METHODS[number];

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

  const existing = await db.query.reparations.findFirst({
    where: eq(tables.reparations.id, id),
  });

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Reparation not found',
    });
  }

  // Validate items if provided
  const items = Array.isArray(body.items) ? body.items : [];
  for (const item of items) {
    if (item.quantity && item.quantity <= 0) {
      throw createError({
        statusCode: 400,
        message: 'Item quantity must be greater than 0',
      });
    }
    if (item.unitCost && (isNaN(item.unitCost) || item.unitCost < 0)) {
      throw createError({
        statusCode: 400,
        message: 'Item unit cost must be a valid number',
      });
    }
  }

  const now = new Date();

  // Calculate costs server-side
  const partsCost = items.reduce((sum: number, item: any) => {
    const qty = item.quantity || 0;
    const cost = item.unitCost || 0;
    return sum + (qty * cost);
  }, 0);

  const laborCost = parseFloat(body.laborCost) || existing.laborCost || 0;
  const totalCost = partsCost + laborCost;
  const price = parseFloat(body.price) || existing.price || 0;

  // Determine if this is a draft being confirmed
  const isConfirmingDraft = existing.status === 'draft' && body.confirmDraft === true;

  // Sequential updates (D1 does not support transactions)
  try {
    // Update reparation
    const updateData: any = {
      updatedAt: now,
    };
    
    if (body.customerId !== undefined) updateData.customerId = body.customerId;
    if (body.reportedIssue !== undefined) updateData.reportedIssue = body.reportedIssue;
    if (body.diagnosis !== undefined) updateData.diagnosis = body.diagnosis;
    if (body.repairNotes !== undefined) updateData.repairNotes = body.repairNotes;
    if (items.length > 0) {
      updateData.partsCost = partsCost;
      updateData.totalCost = totalCost;
    }
    if (body.laborCost !== undefined) {
      updateData.laborCost = laborCost;
      updateData.totalCost = totalCost;
    }
    if (body.price !== undefined) updateData.price = price;
    if (body.isWarranty !== undefined) updateData.isWarranty = !!body.isWarranty;

    // Handle draft confirmation with payment
    if (isConfirmingDraft) {
      updateData.status = 'received';

      const depositAmount = Math.max(0, parseFloat(body.depositAmount) || 0);
      updateData.depositAmount = depositAmount;
      updateData.paidAmount = depositAmount;

      if (depositAmount > 0 && depositAmount >= price) {
        updateData.paymentStatus = 'paid';
      } else if (depositAmount > 0) {
        updateData.paymentStatus = 'partial';
      } else {
        updateData.paymentStatus = 'unpaid';
      }
    }
    
    await db.update(tables.reparations).set(updateData).where(eq(tables.reparations.id, id));

    // Update items if provided
    if (items.length > 0) {
      // Delete existing items
      await db.delete(tables.reparationItems).where(eq(tables.reparationItems.reparationId, id));

      // Insert new items
      for (const item of items) {
        const lineTotal = (item.quantity || 0) * (item.unitCost || 0);
        
        await db.insert(tables.reparationItems).values({
          id: generateId('rit'),
          reparationId: id,
          productId: item.productId || null,
          variantId: item.variantId || null,
          quantity: item.quantity || 1,
          unitCost: item.unitCost || 0,
          lineTotal,
          createdAt: now,
        });
      }
    }

    // Record payment when confirming draft
    if (isConfirmingDraft) {
      const depositAmount = Math.max(0, parseFloat(body.depositAmount) || 0);
      if (depositAmount > 0) {
        let paymentMethod: PaymentMethod = 'cash';
        if (body.paymentMethod) {
          const raw = String(body.paymentMethod).toLowerCase().replace(/_money$/, '');
          paymentMethod = VALID_PAYMENT_METHODS.includes(raw as PaymentMethod) ? (raw as PaymentMethod) : 'cash';
        }

        await db.insert(tables.payments).values({
          id: generateId('pay'),
          reparationId: id,
          amount: depositAmount,
          paymentMethod,
          reference: `Deposit for ${id}`,
          createdAt: now,
        });
      }
    }
  } catch (err: any) {
    console.error('[reparations/PATCH] DB update failed:', err);
    throw createError({
      statusCode: 500,
      message: `Failed to update reparation: ${err?.message || 'Unknown database error'}`,
    });
  }

  return { id, updated: true };
});
