import { eq } from 'drizzle-orm';
import { syncProductStockFromVariants } from '../../../utils/stock';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const saleId = getRouterParam(event, 'id');
  const body = await readBody(event);

  // Extract client and payment information from request body
  const { 
    clientName, 
    clientInfo, 
    customerId, 
    paidAmount = 0,
    finalAmount, // Optional: for discounted credit sales
    paymentType = 'immediate', // 'immediate' or 'credit'
    paymentMethod = 'cash',
    dueDate 
  } = body || {};

  if (!saleId) {
    throw createError({
      statusCode: 400,
      message: 'Sale ID is required',
    });
  }

  // Credit sales require a customer
  if (paymentType === 'credit' && !customerId) {
    throw createError({
      statusCode: 400,
      message: 'Credit sales require a customer to be selected',
    });
  }

  // Get the sale with items
  const sale = await db.query.sales.findFirst({
    where: eq(tables.sales.id, saleId),
    with: {
      items: {
        with: {
          product: true,
          variant: true,
        },
      },
    },
  });

  if (!sale) {
    throw createError({
      statusCode: 404,
      message: 'Sale not found',
    });
  }

  if (sale.status === 'confirmed') {
    throw createError({
      statusCode: 400,
      message: 'Sale is already confirmed',
    });
  }

  if (sale.status === 'cancelled') {
    throw createError({
      statusCode: 400,
      message: 'Cannot confirm a cancelled sale',
    });
  }

  // Validate stock for each item
  const insufficientStock: { productName: string; available: number; requested: number }[] = [];

  for (const item of sale.items) {
    let currentStock: number;
    let productName: string;

    if (item.variantId && item.variant) {
      currentStock = item.variant.stockQuantity || 0;
      productName = `${item.product?.name} - ${item.variant.name}`;
    } else if (item.product) {
      currentStock = item.product.stockQuantity || 0;
      productName = item.product.name;
    } else {
      continue;
    }

    if (currentStock < item.quantity) {
      insufficientStock.push({
        productName,
        available: currentStock,
        requested: item.quantity,
      });
    }
  }

  if (insufficientStock.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'insufficient_stock',
      message: 'Insufficient stock for one or more items',
      data: { items: insufficientStock },
    });
  }

  // Process stock deduction and create movements
  // Track which products need their parent stock synced
  const productsToSync = new Set<string>();

  for (const item of sale.items) {
    if (item.variantId && item.variant) {
      // Deduct from variant stock
      const stockBefore = item.variant.stockQuantity || 0;
      const stockAfter = stockBefore - item.quantity;

      await db
        .update(tables.productVariants)
        .set({
          stockQuantity: stockAfter,
          updatedAt: new Date(),
        })
        .where(eq(tables.productVariants.id, item.variantId));

      // Mark this product for parent stock sync
      productsToSync.add(item.productId);

      // Create stock movement
      await db.insert(tables.stockMovements).values({
        id: generateId('mov'),
        productId: item.productId,
        variantId: item.variantId,
        type: 'sale',
        quantity: -item.quantity,
        stockBefore,
        stockAfter,
        unitCost: item.unitCost,
        reference: `SALE-${saleId}`,
        reason: 'Sale confirmed',
        saleId,
      });
    } else {
      // Deduct from product stock
      const product = await db.query.products.findFirst({
        where: eq(tables.products.id, item.productId),
      });

      if (product) {
        const stockBefore = product.stockQuantity || 0;
        const stockAfter = stockBefore - item.quantity;

        await db
          .update(tables.products)
          .set({
            stockQuantity: stockAfter,
            updatedAt: new Date(),
          })
          .where(eq(tables.products.id, item.productId));

        // Create stock movement
        await db.insert(tables.stockMovements).values({
          id: generateId('mov'),
          productId: item.productId,
          variantId: null,
          type: 'sale',
          quantity: -item.quantity,
          stockBefore,
          stockAfter,
          unitCost: item.unitCost,
          reference: `SALE-${saleId}`,
          reason: 'Sale confirmed',
          saleId,
        });
      }
    }
  }

  // Sync parent product stock for all products that had variant sales
  for (const productId of productsToSync) {
    await syncProductStockFromVariants(db, productId);
  }

  // Calculate payment status based on payment type and amounts
  const originalTotalAmount = sale.totalAmount;
  
  // For credit sales, allow a custom final amount (for discounts)
  // The final amount is what the customer owes, which may be less than original
  const effectiveTotalAmount = (paymentType === 'credit' && finalAmount !== undefined && finalAmount > 0)
    ? Math.min(finalAmount, originalTotalAmount)
    : originalTotalAmount;
  
  // For immediate payment, the full amount is paid
  // For credit sales, use the provided paid amount (can be 0 for full credit, or partial)
  const actualPaidAmount = paymentType === 'immediate' 
    ? effectiveTotalAmount 
    : Math.min(Math.max(0, paidAmount || 0), effectiveTotalAmount);
  
  let paymentStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid';
  if (actualPaidAmount >= effectiveTotalAmount - 0.01) {
    paymentStatus = 'paid';
  } else if (actualPaidAmount > 0) {
    paymentStatus = 'partial';
  }

  // Calculate discount amount if any
  const discountAmount = originalTotalAmount - effectiveTotalAmount;

  // Update sale status to confirmed with client info, payment info, and timestamp
  await db
    .update(tables.sales)
    .set({
      status: 'confirmed',
      customerId: customerId || null,
      clientName: clientName || null,
      clientInfo: clientInfo || null,
      totalAmount: effectiveTotalAmount, // Store the effective amount (after discount)
      paidAmount: actualPaidAmount,
      paymentStatus,
      dueDate: dueDate ? new Date(dueDate) : null,
      confirmedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tables.sales.id, saleId));

  // Create initial payment record if any amount was paid
  if (actualPaidAmount > 0) {
    await db.insert(tables.payments).values({
      id: generateId('pay'),
      saleId: saleId,
      customerId: customerId || null,
      amount: actualPaidAmount,
      paymentMethod: paymentMethod || 'cash',
      reference: body.paymentReference || null,
      notes: paymentType === 'immediate' 
        ? 'Full payment at sale' 
        : 'Advance payment at credit sale',
      createdBy: sale.userId,
    });
  }

  // Update customer balance if customer is selected and there's outstanding amount
  if (customerId && paymentStatus !== 'paid') {
    const outstandingAmount = effectiveTotalAmount - actualPaidAmount;
    const customer = await db.query.customers.findFirst({
      where: eq(tables.customers.id, customerId),
    });

    if (customer) {
      await db
        .update(tables.customers)
        .set({
          currentBalance: (customer.currentBalance || 0) + outstandingAmount,
          updatedAt: new Date(),
        })
        .where(eq(tables.customers.id, customerId));
    }
  }

  // Fetch the updated sale
  const confirmedSale = await db.query.sales.findFirst({
    where: eq(tables.sales.id, saleId),
    with: {
      supplier: true,
      user: true,
      customer: true,
      items: {
        with: {
          product: true,
          variant: true,
        },
      },
    },
  });

  return confirmedSale;
});
