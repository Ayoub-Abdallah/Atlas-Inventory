import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const saleId = getRouterParam(event, 'id');

  if (!saleId) {
    throw createError({
      statusCode: 400,
      message: 'Sale ID is required',
    });
  }

  // Get the sale with all details
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

  if (!sale) {
    throw createError({
      statusCode: 404,
      message: 'Sale not found',
    });
  }

  // Get settings for business info
  const [settings] = await db.select().from(tables.settings).where(eq(tables.settings.id, 1)).limit(1);

  // Generate invoice number if not exists
  const invoiceNumber = sale.invoiceNumber || `INV-${sale.id.slice(-8).toUpperCase()}`;

  // Format currency based on settings
  const currency = settings?.currency || 'DZD';
  const currencySymbol = currency === 'DZD' ? 'DA' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '£';

  // Calculate totals
  const subtotal = sale.items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
  const taxAmount = sale.taxAmount || 0;
  const total = sale.totalAmount || subtotal + taxAmount;

  return {
    ...sale,
    invoiceNumber,
    businessName: settings?.businessName || 'Atlas Inventory',
    currency,
    currencySymbol,
    subtotal,
    taxAmount,
    total,
    formattedDate: sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }) : '',
    formattedConfirmedAt: sale.confirmedAt ? new Date(sale.confirmedAt).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) : null,
  };
});
