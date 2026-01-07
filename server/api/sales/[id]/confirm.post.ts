import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const saleId = getRouterParam(event, 'id');
  const body = await readBody(event);

  // Extract client information from request body
  const { clientName, clientInfo } = body || {};

  if (!saleId) {
    throw createError({
      statusCode: 400,
      message: 'Sale ID is required',
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

  // Update sale status to confirmed with client info and timestamp
  await db
    .update(tables.sales)
    .set({
      status: 'confirmed',
      clientName: clientName || null,
      clientInfo: clientInfo || null,
      confirmedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tables.sales.id, saleId));

  // Fetch the updated sale
  const confirmedSale = await db.query.sales.findFirst({
    where: eq(tables.sales.id, saleId),
    with: {
      supplier: true,
      user: true,
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
