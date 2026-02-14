import { eq, and, sql } from 'drizzle-orm';
import { syncProductStockFromVariants } from '../../../utils/stock';
import { generateId } from '../../../utils/id';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const params = getRouterParams(event);
  const body = await readBody(event);
  const id = params.id;

  if (!id) throw createError({ statusCode: 400, message: 'Return id required' });

  const saleReturn = await db.query.saleReturns.findFirst({ where: eq(tables.saleReturns.id, id) });
  if (!saleReturn) throw createError({ statusCode: 404, message: 'Return not found' });
  if (saleReturn.status === 'processed') return { id, status: 'already_processed' };

  const items = await db.query.saleReturnItems.findMany({ where: eq(tables.saleReturnItems.returnId, id) });
  const now = new Date();

  // Validate quantities vs original sale items
  for (const rit of items) {
    if (rit.saleItemId) {
      const original = await db.query.saleItems.findFirst({ where: eq(tables.saleItems.id, rit.saleItemId) });
      if (!original) throw createError({ statusCode: 400, message: 'Original sale item not found' });

      // Aggregate previously processed returned quantities for this sale_item (exclude current return)
      const prevReturned = await db
        .select({ sum: sql<number>`COALESCE(SUM(${tables.saleReturnItems.quantity}), 0)` })
        .from(tables.saleReturnItems)
        .where(
          and(
            eq(tables.saleReturnItems.saleItemId, rit.saleItemId),
            sql`${tables.saleReturnItems.returnId} IN (SELECT id FROM sale_returns WHERE status = 'processed' AND id != ${id})`
          )
        );
      const alreadyReturned = prevReturned[0]?.sum || 0;

      if ((rit.quantity || 0) + alreadyReturned > (original.quantity || 0)) {
        throw createError({ statusCode: 400, message: 'Return quantity exceeds remaining quantity for this sale item' });
      }
    }
  }

  const stockMovementsCreated: string[] = [];

  // Process stock and create movements
  for (const rit of items) {
    // Load product/variant current stock
    let currentStock = 0;
    let entity: 'variant' | 'product' = 'product';

    if (rit.variantId) {
      const variant = await db.query.productVariants.findFirst({ where: eq(tables.productVariants.id, rit.variantId) });
      if (!variant) throw createError({ statusCode: 404, message: 'Variant not found' });
      currentStock = variant.stockQuantity ?? 0;
      entity = 'variant';
    } else {
      const product = await db.query.products.findFirst({ where: eq(tables.products.id, rit.productId) });
      if (!product) throw createError({ statusCode: 404, message: 'Product not found' });
      currentStock = product.stockQuantity ?? 0;
      entity = 'product';
    }

    const qty = rit.quantity || 0;
    if (qty <= 0) continue;

    if (rit.restocked) {
      const newStock = currentStock + qty;
      const movId = generateId('mov');

      await db.insert(tables.stockMovements).values({
        id: movId,
        productId: rit.productId,
        variantId: rit.variantId || null,
        type: 'return',
        quantity: qty,
        stockBefore: currentStock,
        stockAfter: newStock,
        unitCost: rit.unitCost || null,
        reference: `RETURN-${saleReturn.saleId}`,
        reason: null,
        supplierId: null,
      });

      stockMovementsCreated.push(movId);

      if (entity === 'variant') {
        await db.update(tables.productVariants).set({ stockQuantity: newStock, updatedAt: new Date() }).where(eq(tables.productVariants.id, rit.variantId!));
        await syncProductStockFromVariants(db, rit.productId);
      } else {
        await db.update(tables.products).set({ stockQuantity: newStock, updatedAt: new Date() }).where(eq(tables.products.id, rit.productId));
      }
    } else {
      // Not restocked: record movement with type 'return' but no stock change
      const movId = generateId('mov');
      await db.insert(tables.stockMovements).values({
        id: movId,
        productId: rit.productId,
        variantId: rit.variantId || null,
        type: 'return',
        quantity: 0,
        stockBefore: currentStock,
        stockAfter: currentStock,
        unitCost: rit.unitCost || null,
        reference: `RETURN-${saleReturn.saleId}`,
        reason: 'Not restocked',
        supplierId: null,
      });
      stockMovementsCreated.push(movId);
    }
  }

  // Create refund record if provided
  let refundId: string | null = null;
  if (body.refund && body.refund.amount && body.refund.amount > 0) {
    refundId = generateId('ref');
    await db.insert(tables.refunds).values({
      id: refundId,
      saleReturnId: id,
      amount: body.refund.amount,
      paymentMethod: body.refund.method || null,
      reference: body.refund.reference || null,
      createdBy: event.context?.user?.id || null,
      createdAt: now,
    });

    // Update saleReturn refundedAmount
    await db.update(tables.saleReturns).set({ refundedAmount: body.refund.amount }).where(eq(tables.saleReturns.id, id));
  }

  // Mark processed
  await db.update(tables.saleReturns).set({ status: 'processed', processedAt: now }).where(eq(tables.saleReturns.id, id));

  // Update sale financials - CRITICAL FOR FINANCIAL ACCURACY
  try {
    const sale = await db.query.sales.findFirst({ 
      where: eq(tables.sales.id, saleReturn.saleId), 
      with: { items: true, returns: { with: { items: true } } }
    });
    
    if (sale) {
      // Calculate total returned amounts (only processed returns)
      const processedReturns = sale.returns?.filter((r: any) => r.status === 'processed') || [];
      const totalReturnedAmount = processedReturns.reduce((sum: number, r: any) => sum + (r.totalAmount || 0), 0);
      const totalReturnedCost = processedReturns.reduce((sum: number, r: any) => sum + (r.totalCost || 0), 0);
      
      // Calculate original sale totals
      const originalTotalAmount = sale.items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
      const originalTotalCost = sale.items.reduce((sum, item) => sum + ((item.unitCost || 0) * (item.quantity || 0)), 0);
      
      // Calculate adjusted totals (original - returned)
      const adjustedTotalAmount = originalTotalAmount - totalReturnedAmount;
      const adjustedTotalCost = originalTotalCost - totalReturnedCost;
      
      // Determine if it's a full return
      const saleQty = sale.items.reduce((s, it) => s + (it.quantity || 0), 0);
      const returnedQty = processedReturns.reduce((sum: number, r: any) => {
        return sum + (r.items?.reduce((itemSum: number, i: any) => itemSum + (i.quantity || 0), 0) || 0);
      }, 0);
      
      const isFullReturn = returnedQty >= saleQty;
      
      // Update sale record with adjusted totals
      const updates: any = {
        // Store original values in metadata for audit
        metadata: JSON.stringify({
          originalTotalAmount,
          originalTotalCost,
          totalReturnedAmount,
          totalReturnedCost,
          adjustedTotalAmount,
          adjustedTotalCost,
          hasReturns: true,
        }),
      };
      
      // If full return, mark as returned
      if (isFullReturn) {
        updates.status = 'returned';
      }
      
      await db.update(tables.sales).set(updates).where(eq(tables.sales.id, sale.id));
    }
  } catch (e) {
    console.error('Error updating sale financials after return', e);
    // Don't throw - return was processed successfully even if sale update failed
  }

  return { id, processedAt: now, stockMovementsCreated, refundId };
});
