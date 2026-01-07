import { and, gte, lte, eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);

  const metric = (query.metric as string) || 'revenue';
  const range = (query.range as string) || '30d';

  // Calculate date range
  let fromDate = new Date();
  const toDate = new Date();

  switch (range) {
    case '7d':
      fromDate.setDate(fromDate.getDate() - 7);
      break;
    case '30d':
      fromDate.setDate(fromDate.getDate() - 30);
      break;
    case '90d':
      fromDate.setDate(fromDate.getDate() - 90);
      break;
    case '1y':
      fromDate.setFullYear(fromDate.getFullYear() - 1);
      break;
    default:
      fromDate.setDate(fromDate.getDate() - 30);
  }

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
          product: {
            with: {
              category: true,
            },
          },
        },
      },
      supplier: true,
    },
  });

  // Group by date for timeseries
  const dailyData: Record<string, {
    date: string;
    revenue: number;
    cost: number;
    profit: number;
    salesCount: number;
  }> = {};

  // Initialize all dates in range
  const currentDate = new Date(fromDate);
  while (currentDate <= toDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    dailyData[dateKey] = {
      date: dateKey,
      revenue: 0,
      cost: 0,
      profit: 0,
      salesCount: 0,
    };
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Aggregate sales by date
  for (const sale of salesData) {
    if (sale.createdAt) {
      const dateKey = new Date(sale.createdAt).toISOString().split('T')[0];
      if (dailyData[dateKey]) {
        dailyData[dateKey].revenue += sale.totalAmount || 0;
        dailyData[dateKey].cost += sale.totalCost || 0;
        dailyData[dateKey].profit += (sale.totalAmount || 0) - (sale.totalCost || 0);
        dailyData[dateKey].salesCount += 1;
      }
    }
  }

  const timeseries = Object.values(dailyData).sort((a, b) => 
    a.date.localeCompare(b.date)
  );

  // Category distribution
  const categoryData: Record<string, {
    id: string;
    name: string;
    revenue: number;
    color: string;
  }> = {};

  for (const sale of salesData) {
    for (const item of sale.items) {
      const category = item.product?.category;
      if (category) {
        if (!categoryData[category.id]) {
          categoryData[category.id] = {
            id: category.id,
            name: category.name,
            revenue: 0,
            color: category.color || '#6B7280',
          };
        }
        categoryData[category.id].revenue += item.lineTotal;
      }
    }
  }

  const categoryDistribution = Object.values(categoryData)
    .sort((a, b) => b.revenue - a.revenue);

  // Supplier distribution
  const supplierData: Record<string, {
    id: string;
    name: string;
    revenue: number;
  }> = {};

  for (const sale of salesData) {
    if (sale.supplierId && sale.supplier) {
      if (!supplierData[sale.supplierId]) {
        supplierData[sale.supplierId] = {
          id: sale.supplierId,
          name: sale.supplier.name,
          revenue: 0,
        };
      }
      supplierData[sale.supplierId].revenue += sale.totalAmount || 0;
    }
  }

  const supplierDistribution = Object.values(supplierData)
    .sort((a, b) => b.revenue - a.revenue);

  return {
    period: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      range,
    },
    timeseries,
    categoryDistribution,
    supplierDistribution,
  };
});
