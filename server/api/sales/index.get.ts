import { desc, eq, and, gte, lte, or, like, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);

  const startDate = query.startDate as string | undefined;
  const endDate = query.endDate as string | undefined;
  const search = query.search as string | undefined;

  // Build where conditions
  const conditions = [];

  // Date filtering using UTC to avoid timezone issues
  if (startDate) {
    const fromDate = new Date(startDate + 'T00:00:00.000Z');
    const fromMs = fromDate.getTime();
    // Helper to convert stored createdAt to milliseconds
    const toMsTimestamp = (val: any) => {
      if (!val) return 0;
      if (val instanceof Date) return val.getTime();
      const n = typeof val === 'string' ? Number(val) : val;
      if (Number.isNaN(n)) return 0;
      return n < 1e12 ? n * 1000 : n;
    };
    // We'll filter in JS since the column might store seconds or ms
  }

  if (endDate) {
    const toDate = new Date(endDate + 'T00:00:00.000Z');
    toDate.setUTCDate(toDate.getUTCDate() + 1); // Include the end date
  }

  // Fetch all sales first
  let salesList = await db.query.sales.findMany({
    orderBy: [desc(tables.sales.createdAt)],
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

  // Filter by date in JS to handle seconds/milliseconds timestamp ambiguity
  if (startDate || endDate) {
    const fromMs = startDate ? new Date(startDate + 'T00:00:00.000Z').getTime() : 0;
    const toDate = endDate ? new Date(endDate + 'T00:00:00.000Z') : new Date();
    if (endDate) toDate.setUTCDate(toDate.getUTCDate() + 1);
    const toMs = toDate.getTime();

    const toMsTimestamp = (val: any) => {
      if (!val) return 0;
      if (val instanceof Date) return val.getTime();
      const n = typeof val === 'string' ? Number(val) : val;
      if (Number.isNaN(n)) return 0;
      return n < 1e12 ? n * 1000 : n;
    };

    salesList = salesList.filter((sale) => {
      const ts = toMsTimestamp(sale.createdAt);
      return ts >= fromMs && ts < toMs;
    });
  }

  // Filter by search (customer name, supplier name, sale ID, product names)
  if (search && search.trim()) {
    const searchLower = search.toLowerCase().trim();
    salesList = salesList.filter((sale) => {
      // Search in sale ID
      if (sale.id.toLowerCase().includes(searchLower)) return true;
      
      // Search in supplier name
      if (sale.supplier?.name?.toLowerCase().includes(searchLower)) return true;
      
      // Search in customer name
      if (sale.customer?.name?.toLowerCase().includes(searchLower)) return true;
      
      // Search in product names
      if (sale.items?.some((item: any) => 
        item.product?.name?.toLowerCase().includes(searchLower) ||
        item.variant?.name?.toLowerCase().includes(searchLower)
      )) return true;
      
      return false;
    });
  }

  return salesList;
});
