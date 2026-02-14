import { eq, and, gte, lte, like, or, desc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);

  const startDate = query.startDate as string | undefined;
  const endDate = query.endDate as string | undefined;
  const status = query.status as string | undefined;
  const search = query.search as string | undefined;

  // Fetch all reparations first
  let reparationsList = await db.query.reparations.findMany({
    orderBy: [desc(tables.reparations.createdAt)],
    with: {
      customer: true,
      items: true,
    },
  });

  // Helper: normalize timestamp to milliseconds (handles seconds vs ms ambiguity)
  const toMs = (val: any): number => {
    if (!val) return 0;
    if (val instanceof Date) return val.getTime();
    const n = typeof val === 'string' ? Number(val) : val;
    if (Number.isNaN(n)) return 0;
    return n < 1e12 ? n * 1000 : n;
  };

  // Filter by date in JS to handle seconds/milliseconds timestamp ambiguity
  // Dates come as local date strings (YYYY-MM-DD), parse as local time boundaries
  if (startDate || endDate) {
    const fromMs = startDate ? new Date(startDate + 'T00:00:00').getTime() : 0;
    const toDate = endDate ? new Date(endDate + 'T23:59:59.999') : new Date();
    const toMsVal = toDate.getTime();

    reparationsList = reparationsList.filter((r: any) => {
      const ts = toMs(r.createdAt);
      if (startDate && ts < fromMs) return false;
      if (endDate && ts > toMsVal) return false;
      return true;
    });
  }

  // Filter by status
  if (status && status !== 'all') {
    reparationsList = reparationsList.filter((r: any) => r.status === status);
  }

  // Filter by search
  if (search) {
    const q = search.toLowerCase();
    reparationsList = reparationsList.filter((r: any) => {
      return (
        (r.id || '').toLowerCase().includes(q) ||
        (r.reportedIssue || '').toLowerCase().includes(q) ||
        (r.customer?.name || '').toLowerCase().includes(q) ||
        (r.customer?.phone || '').toLowerCase().includes(q)
      );
    });
  }

  return reparationsList;
});
