import { and, gte, lte, eq, ne, or } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);

  const metric = (query.metric as string) || 'revenue';
  const range = (query.range as string) || '';
  const sourceFilter = (query.source as string) || ''; // 'product', 'reparation', or '' for all

  // Allow overriding with explicit from/to query params (YYYY-MM-DD)
  const qFrom = (query.from as string) || undefined;
  const qTo = (query.to as string) || undefined;

  console.log('[chart-data] REQUEST:', { range, qFrom, qTo });

  // Calculate date range (using local time to match user's timezone)
  let fromDate = new Date();
  let toDate = new Date();

  // Parse dates as local time to match user's timezone
  if (qFrom) {
    fromDate = new Date(qFrom + 'T00:00:00');
    if (qTo) {
      toDate = new Date(qTo + 'T23:59:59.999');
    } else {
      toDate = new Date();
      toDate.setHours(23, 59, 59, 999);
    }
  } else if (range === 'today') {
    fromDate = new Date();
    fromDate.setHours(0, 0, 0, 0);
    toDate = new Date();
    toDate.setHours(23, 59, 59, 999);
  } else {
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
  }

  // Get confirmed sales (skip if filtering reparation only)
  const salesData = sourceFilter === 'reparation' ? [] : await db.query.sales.findMany({
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

  // Helper to get local date string from a Date object
  const toLocalDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Initialize all dates in range
  const currentDate = new Date(fromDate);
  const endDateOnly = new Date(toDate);

  // Ensure chart always shows at least through today
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  if (endDateOnly < todayEnd) {
    endDateOnly.setTime(todayEnd.getTime());
  }

  while (currentDate <= endDateOnly) {
    const dateKey = toLocalDateKey(currentDate);
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
  for (const sale of filteredSales) {
    const ts = toMsTimestamp(sale.createdAt);
    const dateKey = toLocalDateKey(new Date(ts));
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

  // Process returns in the period (skip if filtering reparation only)
  if (sourceFilter !== 'reparation') {
  try {
    const returns = await db.query.saleReturns.findMany({
      where: eq(tables.saleReturns.status, 'processed'),
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
        sale: {
          with: {
            supplier: true,
          },
        },
      },
    });

    for (const ret of returns) {
      const processedMs = toMsTimestamp(ret.processedAt || ret.createdAt);
      if (processedMs >= fromMs && processedMs < toMs) {
        const dateKey = toLocalDateKey(new Date(processedMs));
        if (dailyData[dateKey]) {
          const amt = ret.totalAmount || (ret.items || []).reduce((s: number, it: any) => s + (it.lineTotal || 0), 0);
          const cost = ret.totalCost || (ret.items || []).reduce((s: number, it: any) => s + ((it.unitCost || 0) * (it.quantity || 0)), 0);
          dailyData[dateKey].revenue -= amt;
          dailyData[dateKey].cost -= cost;
          dailyData[dateKey].profit -= (amt - cost);
        }

        // Subtract from category distribution
        for (const it of ret.items || []) {
          const category = it.product?.category;
          if (category && categoryData[category.id]) {
            categoryData[category.id].revenue -= it.lineTotal || 0;
          }
        }

        // Subtract from supplier distribution
        const supId = ret.sale?.supplierId;
        if (supId && supplierData[supId]) {
          supplierData[supId].revenue -= ret.totalAmount || 0;
        }
      }
    }
  } catch (e) {
    console.error('Error processing sale returns for chart data', e);
  }
  } // end sourceFilter !== 'reparation'

  // Include all non-draft/non-cancelled reparations as revenue events (skip if filtering product only)
  if (sourceFilter !== 'product') {
  try {
    const reparations = await db.query.reparations.findMany({
      where: and(
        ne(tables.reparations.status, 'draft'),
        ne(tables.reparations.status, 'cancelled')
      ),
    });
    for (const r of reparations) {
      const closedMs = toMsTimestamp(r.closedAt || r.updatedAt || r.createdAt);
      if (closedMs >= fromMs && closedMs < toMs) {
        const dateKey = toLocalDateKey(new Date(closedMs));
        if (dailyData[dateKey]) {
          const revenue = r.price || 0;
          const cost = r.totalCost || 0;
          dailyData[dateKey].revenue += revenue;
          dailyData[dateKey].cost += cost;
          dailyData[dateKey].profit += (revenue - cost);
          dailyData[dateKey].salesCount += 1;
        }
      }
    }
  } catch (e) {
    console.error('Error including reparations in chart data', e);
  }
  } // end sourceFilter !== 'product'

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
