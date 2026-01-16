import { and, gte, lte, eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);

  const metric = (query.metric as string) || 'revenue';
  const range = (query.range as string) || '';

  // Allow overriding with explicit from/to query params (YYYY-MM-DD)
  const qFrom = (query.from as string) || undefined;
  const qTo = (query.to as string) || undefined;

  console.log('[chart-data] REQUEST:', { range, qFrom, qTo });

  // Calculate date range (using UTC to avoid timezone shifts)
  let fromDate = new Date();
  let toDate = new Date();

  if (qFrom) {
    fromDate = new Date(qFrom + 'T00:00:00.000Z');
    if (qTo) {
      // Set to start of NEXT day (exclusive upper bound)
      toDate = new Date(qTo + 'T00:00:00.000Z');
      toDate.setUTCDate(toDate.getUTCDate() + 1);
    } else {
      // Default: start of tomorrow UTC
      toDate = new Date();
      toDate.setUTCHours(0, 0, 0, 0);
      toDate.setUTCDate(toDate.getUTCDate() + 1);
    }
  } else if (range === 'today') {
    fromDate = new Date();
    fromDate.setUTCHours(0, 0, 0, 0);
    // CRITICAL FIX: toDate must be start of TOMORROW
    toDate = new Date();
    toDate.setUTCHours(0, 0, 0, 0);
    toDate.setUTCDate(toDate.getUTCDate() + 1);
  } else {
    switch (range) {
      case '7d':
        fromDate.setUTCDate(fromDate.getUTCDate() - 7);
        break;
      case '30d':
        fromDate.setUTCDate(fromDate.getUTCDate() - 30);
        break;
      case '90d':
        fromDate.setUTCDate(fromDate.getUTCDate() - 90);
        break;
      case '1y':
        fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 1);
        break;
      default:
        fromDate.setUTCDate(fromDate.getUTCDate() - 30);
    }
    fromDate.setUTCHours(0, 0, 0, 0);
    // toDate is start of tomorrow UTC
    toDate.setUTCHours(0, 0, 0, 0);
    toDate.setUTCDate(toDate.getUTCDate() + 1);
  }

  // Get confirmed sales (date filtering done in JS to handle seconds/ms ambiguity)
  const salesData = await db.query.sales.findMany({
    where: eq(tables.sales.status, 'confirmed'),
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

  // Normalize and filter sales by date in milliseconds to handle both seconds and milliseconds storage
  const fromMs = fromDate.getTime();
  const toMs = toDate.getTime();

  // Helper: convert stored createdAt to milliseconds reliably
  const toMsTimestamp = (val: any) => {
    if (!val) return 0;
    // If it's a Date object
    if (val instanceof Date) return val.getTime();
    // If it's numeric-like string, coerce
    const n = typeof val === 'string' ? Number(val) : val;
    if (Number.isNaN(n)) return 0;
    // Heuristic: values < 1e12 are seconds, >= 1e12 are milliseconds
    return n < 1e12 ? n * 1000 : n;
  };

  // Debug: log date range and raw counts
  console.log('[finance/chart-data] from:', fromDate.toISOString(), 'to:', toDate.toISOString(), 'rawSales:', salesData.length);

  const filteredSales = salesData.filter((sale) => {
    const ts = toMsTimestamp(sale.createdAt);
    // Use < instead of <= since toDate is now start of tomorrow
    return ts >= fromMs && ts < toMs;
  });

  console.log('[finance/chart-data] sales after date filter:', filteredSales.length);

  // Group by date for timeseries
  const dailyData: Record<string, {
    date: string;
    revenue: number;
    cost: number;
    profit: number;
    salesCount: number;
  }> = {};

  // Initialize all dates in range up to (but not including) toDate
  // toDate is start of tomorrow, so this creates labels through today
  const currentDate = new Date(fromDate);
  const endDateOnly = new Date(toDate);

  // Ensure chart always shows tomorrow's boundary (at minimum)
  const tomorrow = new Date();
  tomorrow.setUTCHours(0, 0, 0, 0);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (endDateOnly < tomorrow) {
    endDateOnly.setTime(tomorrow.getTime());
  }

  while (currentDate < endDateOnly) {
    const dateKey = currentDate.toISOString().split('T')[0];
    dailyData[dateKey] = {
      date: dateKey,
      revenue: 0,
      cost: 0,
      profit: 0,
      salesCount: 0,
    };
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  // Aggregate sales by date
  for (const sale of filteredSales) {
    const ts = toMsTimestamp(sale.createdAt);
    const dateKey = new Date(ts).toISOString().split('T')[0];
    if (dailyData[dateKey]) {
      dailyData[dateKey].revenue += sale.totalAmount || 0;
      dailyData[dateKey].cost += sale.totalCost || 0;
      dailyData[dateKey].profit += (sale.totalAmount || 0) - (sale.totalCost || 0);
      dailyData[dateKey].salesCount += 1;
    }
  }

  const timeseries = Object.values(dailyData).sort((a, b) => 
    a.date.localeCompare(b.date)
  );

  // Category distribution (using filtered sales to respect date range)
  const categoryData: Record<string, {
    id: string;
    name: string;
    revenue: number;
    color: string;
  }> = {};

  for (const sale of filteredSales) {
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

  // Supplier distribution (using filtered sales to respect date range)
  const supplierData: Record<string, {
    id: string;
    name: string;
    revenue: number;
  }> = {};

  for (const sale of filteredSales) {
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
