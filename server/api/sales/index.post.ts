import { eq } from 'drizzle-orm';

interface SaleItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number;
  taxRate?: number;
}

interface CreateSaleBody {
  supplierId?: string;
  items: SaleItemInput[];
  notes?: string;
  metadata?: Record<string, unknown>;
}

export default defineEventHandler(async (event) => {
  const db = useDB();
  const body = await readBody<CreateSaleBody>(event);
  const session = await getUserSession(event);

  // Validate items
  if (!body.items || body.items.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'At least one item is required',
    });
  }

  // Calculate totals
  let totalAmount = 0;
  let totalCost = 0;
  let taxAmount = 0;

  const itemsToInsert = [];

  for (const item of body.items) {
    if (!item.productId || !item.quantity || item.quantity <= 0) {
      throw createError({
        statusCode: 400,
        message: 'Invalid item: productId and positive quantity required',
      });
    }

    const lineTotal = item.unitPrice * item.quantity;
    const lineCost = (item.unitCost || 0) * item.quantity;
    const lineTax = lineTotal * ((item.taxRate || 0) / 100);

    totalAmount += lineTotal;
    totalCost += lineCost;
    taxAmount += lineTax;

    itemsToInsert.push({
      id: generateId('sitem'),
      productId: item.productId,
      variantId: item.variantId || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost || 0,
      taxRate: item.taxRate || 0,
      lineTotal,
    });
  }

  // Create sale
  const saleId = generateId('sale');
  
  await db.insert(tables.sales).values({
    id: saleId,
    supplierId: body.supplierId || null,
    userId: session.user?.id || null,
    status: 'draft',
    totalAmount,
    totalCost,
    taxAmount,
    notes: body.notes || null,
    metadata: body.metadata || null,
  });

  // Insert sale items
  for (const item of itemsToInsert) {
    await db.insert(tables.saleItems).values({
      ...item,
      saleId,
    });
  }

  // Fetch the created sale with relations
  const sale = await db.query.sales.findFirst({
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

  return sale;
});
