import { and, eq, ne, desc, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();

  // Get all confirmed sales that are not fully paid
  const unpaidSales = await db.query.sales.findMany({
    where: and(
      eq(tables.sales.status, 'confirmed'),
      ne(tables.sales.paymentStatus, 'paid')
    ),
    orderBy: [desc(tables.sales.createdAt)],
    with: {
      customer: true,
      items: {
        with: {
          product: true,
        },
      },
    },
  });

  // Get all customers with outstanding balances
  const customersWithBalance = await db.query.customers.findMany({
    where: sql`${tables.customers.currentBalance} > 0`,
    orderBy: [desc(tables.customers.currentBalance)],
  });

  // Calculate totals
  const totalReceivables = unpaidSales.reduce(
    (sum, sale) => sum + ((sale.totalAmount || 0) - (sale.paidAmount || 0)),
    0
  );

  const totalPartiallyPaid = unpaidSales
    .filter(s => s.paymentStatus === 'partial')
    .reduce((sum, s) => sum + ((s.totalAmount || 0) - (s.paidAmount || 0)), 0);

  const totalUnpaid = unpaidSales
    .filter(s => s.paymentStatus === 'unpaid')
    .reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  // Group sales by customer
  const salesByCustomer: Record<string, {
    customerId: string | null;
    customerName: string;
    sales: typeof unpaidSales;
    totalOutstanding: number;
  }> = {};

  for (const sale of unpaidSales) {
    const customerId = sale.customerId || 'walk-in';
    const customerName = sale.customer?.name || sale.clientName || 'Walk-in Customer';

    if (!salesByCustomer[customerId]) {
      salesByCustomer[customerId] = {
        customerId: sale.customerId,
        customerName,
        sales: [],
        totalOutstanding: 0,
      };
    }

    salesByCustomer[customerId].sales.push(sale);
    salesByCustomer[customerId].totalOutstanding += (sale.totalAmount || 0) - (sale.paidAmount || 0);
  }

  const groupedByCustomer = Object.values(salesByCustomer)
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding);

  // Get overdue sales (past due date)
  const now = new Date();
  const overdueSales = unpaidSales.filter(
    sale => sale.dueDate && new Date(sale.dueDate) < now
  );

  const overdueAmount = overdueSales.reduce(
    (sum, sale) => sum + ((sale.totalAmount || 0) - (sale.paidAmount || 0)),
    0
  );

  return {
    summary: {
      totalReceivables,
      totalPartiallyPaid,
      totalUnpaid,
      overdueAmount,
      unpaidSalesCount: unpaidSales.filter(s => s.paymentStatus === 'unpaid').length,
      partialSalesCount: unpaidSales.filter(s => s.paymentStatus === 'partial').length,
      overdueSalesCount: overdueSales.length,
      customersWithDebt: customersWithBalance.length,
    },
    groupedByCustomer,
    overdueSales: overdueSales.map(s => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      customerName: s.customer?.name || s.clientName || 'Walk-in',
      totalAmount: s.totalAmount,
      paidAmount: s.paidAmount,
      outstanding: (s.totalAmount || 0) - (s.paidAmount || 0),
      dueDate: s.dueDate,
      createdAt: s.createdAt,
    })),
    customersWithBalance,
  };
});
