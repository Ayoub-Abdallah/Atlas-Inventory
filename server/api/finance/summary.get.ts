import { and, gte, lte, eq, sql, desc, ne } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);

  // Parse date range
  const from = query.from as string;
  const to = query.to as string;

  let fromDate: Date;
  let toDate: Date;

  if (from) {
    fromDate = new Date(from);
  } else {
    // Default to last 30 days
    fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
  }

  if (to) {
    toDate = new Date(to);
  } else {
    toDate = new Date();
  }

  // Set time to start/end of day
  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(23, 59, 59, 999);

  // Get confirmed sales within date range
  const salesData = await db.query.sales.findMany({
    where: and(
      eq(tables.sales.status, 'confirmed'),
      gte(tables.sales.createdAt, fromDate),
      lte(tables.sales.createdAt, toDate)
    ),
    with: {
      items: {
        with: {
          product: true,
        },
      },
      supplier: true,
      customer: true,
    },
  });

  // Get expenses within date range
  const expensesData = await db.query.expenses.findMany({
    where: and(
      gte(tables.expenses.date, fromDate),
      lte(tables.expenses.date, toDate)
    ),
    with: {
      category: true,
    },
  });

  // Calculate aggregated metrics
  const totalRevenue = salesData.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const totalCost = salesData.reduce((sum, s) => sum + (s.totalCost || 0), 0);
  const totalTax = salesData.reduce((sum, s) => sum + (s.taxAmount || 0), 0);
  const grossProfit = totalRevenue - totalCost;
  const numberOfSales = salesData.length;
  const avgOrderValue = numberOfSales > 0 ? totalRevenue / numberOfSales : 0;

  // Calculate actual income (only paid amounts) and pending receivables
  const actualIncome = salesData.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
  const pendingReceivables = salesData.reduce(
    (sum, s) => sum + ((s.totalAmount || 0) - (s.paidAmount || 0)),
    0
  );

  // Calculate total expenses
  const totalExpenses = expensesData.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Calculate net profit (actual income - cost of goods sold - operational expenses)
  const netProfit = actualIncome - totalCost - totalExpenses;

  // Get expenses by category
  const expensesByCategory: Record<string, {
    categoryId: string | null;
    categoryName: string;
    total: number;
    count: number;
  }> = {};

  for (const expense of expensesData) {
    const catId = expense.categoryId || 'uncategorized';
    const catName = expense.category?.name || 'Uncategorized';
    
    if (!expensesByCategory[catId]) {
      expensesByCategory[catId] = {
        categoryId: expense.categoryId,
        categoryName: catName,
        total: 0,
        count: 0,
      };
    }
    expensesByCategory[catId].total += expense.amount;
    expensesByCategory[catId].count += 1;
  }

  const expenseBreakdown = Object.values(expensesByCategory)
    .sort((a, b) => b.total - a.total);

  // Calculate top products by revenue
  const productRevenue: Record<string, { 
    id: string; 
    name: string; 
    revenue: number; 
    unitsSold: number;
    avgPrice: number;
  }> = {};

  for (const sale of salesData) {
    for (const item of sale.items) {
      const productId = item.productId;
      const productName = item.product?.name || 'Unknown';
      
      if (!productRevenue[productId]) {
        productRevenue[productId] = {
          id: productId,
          name: productName,
          revenue: 0,
          unitsSold: 0,
          avgPrice: 0,
        };
      }
      
      productRevenue[productId].revenue += item.lineTotal;
      productRevenue[productId].unitsSold += item.quantity;
    }
  }

  // Calculate average price for each product
  Object.values(productRevenue).forEach(p => {
    p.avgPrice = p.unitsSold > 0 ? p.revenue / p.unitsSold : 0;
  });

  const topProducts = Object.values(productRevenue)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Calculate top suppliers
  const supplierRevenue: Record<string, {
    id: string;
    name: string;
    revenue: number;
    salesCount: number;
  }> = {};

  for (const sale of salesData) {
    if (sale.supplierId && sale.supplier) {
      if (!supplierRevenue[sale.supplierId]) {
        supplierRevenue[sale.supplierId] = {
          id: sale.supplierId,
          name: sale.supplier.name,
          revenue: 0,
          salesCount: 0,
        };
      }
      supplierRevenue[sale.supplierId].revenue += sale.totalAmount || 0;
      supplierRevenue[sale.supplierId].salesCount += 1;
    }
  }

  const topSuppliers = Object.values(supplierRevenue)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Get recent sales
  const recentSales = salesData
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
    .slice(0, 10)
    .map(s => ({
      id: s.id,
      totalAmount: s.totalAmount,
      paidAmount: s.paidAmount,
      paymentStatus: s.paymentStatus,
      taxAmount: s.taxAmount,
      status: s.status,
      createdAt: s.createdAt,
      supplierName: s.supplier?.name,
      customerName: s.customer?.name || s.clientName,
      itemCount: s.items.length,
    }));

  // Get sales by payment status
  const salesByPaymentStatus = {
    paid: salesData.filter(s => s.paymentStatus === 'paid').length,
    partial: salesData.filter(s => s.paymentStatus === 'partial').length,
    unpaid: salesData.filter(s => s.paymentStatus === 'unpaid').length,
  };

  return {
    period: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    },
    summary: {
      totalRevenue,
      totalCost,
      grossProfit,
      actualIncome,
      pendingReceivables,
      totalExpenses,
      netProfit,
      taxesCollected: totalTax,
      numberOfSales,
      avgOrderValue,
    },
    salesByPaymentStatus,
    topProducts,
    topSuppliers,
    expenseBreakdown,
    recentSales,
  };
});
