import { and, gte, lte, eq, sql, desc } from 'drizzle-orm';

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
    },
  });

  // Calculate aggregated metrics
  const totalRevenue = salesData.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const totalCost = salesData.reduce((sum, s) => sum + (s.totalCost || 0), 0);
  const totalTax = salesData.reduce((sum, s) => sum + (s.taxAmount || 0), 0);
  const grossProfit = totalRevenue - totalCost;
  const numberOfSales = salesData.length;
  const avgOrderValue = numberOfSales > 0 ? totalRevenue / numberOfSales : 0;

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
      taxAmount: s.taxAmount,
      status: s.status,
      createdAt: s.createdAt,
      supplierName: s.supplier?.name,
      itemCount: s.items.length,
    }));

  return {
    period: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    },
    summary: {
      totalRevenue,
      totalCost,
      grossProfit,
      taxesCollected: totalTax,
      numberOfSales,
      avgOrderValue,
    },
    topProducts,
    topSuppliers,
    recentSales,
  };
});
