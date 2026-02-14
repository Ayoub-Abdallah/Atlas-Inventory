import { desc, eq, ne, and, gte, lte, or, like, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);

  const startDate = query.startDate as string | undefined;
  const endDate = query.endDate as string | undefined;
  const search = query.search as string | undefined;
  const sourceFilter = query.source as string | undefined; // 'product', 'reparation', or undefined for all

  // Helper: convert stored createdAt to milliseconds reliably
  const toMsTimestamp = (val: any) => {
    if (!val) return 0;
    if (val instanceof Date) return val.getTime();
    const n = typeof val === 'string' ? Number(val) : val;
    if (Number.isNaN(n)) return 0;
    return n < 1e12 ? n * 1000 : n;
  };

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

  // Normalize sales records with sourceType
  let combinedList: any[] = salesList.map((sale) => ({
    ...sale,
    sourceType: 'product',
  }));

  // Fetch all non-draft/non-cancelled reparations and merge as revenue records
  if (sourceFilter !== 'product') {
    const reparationsData = await db.query.reparations.findMany({
      where: and(
        ne(tables.reparations.status, 'draft'),
        ne(tables.reparations.status, 'cancelled')
      ),
      with: {
        customer: true,
        items: true,
        handler: true,
      },
    });

    const reparationRecords = reparationsData.map((rep: any) => ({
      id: rep.id,
      sourceType: 'reparation' as const,
      status: 'confirmed', // Treat completed reparations as confirmed revenue
      reparationStatus: rep.status,
      createdAt: rep.createdAt,
      updatedAt: rep.updatedAt,
      totalAmount: rep.price || 0,
      totalCost: rep.totalCost || 0,
      taxAmount: 0,
      paidAmount: rep.paidAmount || 0,
      paymentStatus: rep.paymentStatus || 'unpaid',
      customerId: rep.customerId,
      customer: rep.customer,
      supplier: null,
      user: rep.handler,
      items: (rep.items || []).map((item: any) => ({
        ...item,
        product: null,
        variant: null,
        lineTotal: item.lineTotal || (item.unitCost || 0) * (item.quantity || 0),
      })),
      reportedIssue: rep.reportedIssue,
      isWarranty: rep.isWarranty,
      partsCost: rep.partsCost,
      laborCost: rep.laborCost,
      price: rep.price,
    }));

    combinedList = [...combinedList, ...reparationRecords];
  }

  // Filter by source type
  if (sourceFilter === 'product') {
    combinedList = combinedList.filter((item) => item.sourceType === 'product');
  } else if (sourceFilter === 'reparation') {
    combinedList = combinedList.filter((item) => item.sourceType === 'reparation');
  }

  // Filter by date in JS to handle seconds/milliseconds timestamp ambiguity
  // Dates come as local date strings (YYYY-MM-DD), parse as local time boundaries
  if (startDate || endDate) {
    const fromMs = startDate ? new Date(startDate + 'T00:00:00').getTime() : 0;
    const toMs = endDate ? new Date(endDate + 'T23:59:59.999').getTime() : Date.now();

    combinedList = combinedList.filter((item) => {
      const ts = toMsTimestamp(item.createdAt);
      return ts >= fromMs && ts <= toMs;
    });
  }

  // Filter by search (customer name, supplier name, ID, product names, reported issue)
  if (search && search.trim()) {
    const searchLower = search.toLowerCase().trim();
    combinedList = combinedList.filter((item) => {
      if (item.id.toLowerCase().includes(searchLower)) return true;
      if (item.supplier?.name?.toLowerCase().includes(searchLower)) return true;
      if (item.customer?.name?.toLowerCase().includes(searchLower)) return true;
      
      if (item.sourceType === 'reparation') {
        if (item.reportedIssue?.toLowerCase().includes(searchLower)) return true;
      }
      
      if (item.items?.some((it: any) => 
        it.product?.name?.toLowerCase().includes(searchLower) ||
        it.variant?.name?.toLowerCase().includes(searchLower)
      )) return true;
      
      return false;
    });
  }

  // Sort by createdAt descending
  combinedList.sort((a, b) => {
    const tsA = toMsTimestamp(a.createdAt);
    const tsB = toMsTimestamp(b.createdAt);
    return tsB - tsA;
  });

  return combinedList;
});
