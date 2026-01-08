import { eq } from 'drizzle-orm';

interface RecordZakatBody {
  zakatDate?: string | Date;
  inventoryValue: number;
  cashBalance: number;
  receivables: number;
  otherAssets: number;
  totalAssets: number;
  shortTermLiabilities: number;
  netZakatableAssets: number;
  nisabAtTime: number;
  meetsNisab: boolean;
  zakatAmount: number;
  zakatRate?: number;
  notes?: string;
  currency?: string;
}

export default defineEventHandler(async (event) => {
  const db = useDB();
  const body = await readBody<RecordZakatBody>(event);

  // Validate required fields
  if (body.totalAssets === undefined || body.zakatAmount === undefined) {
    throw createError({
      statusCode: 400,
      message: 'Total assets and zakat amount are required',
    });
  }

  // Create new zakat history record
  const id = generateId('zakat');
  
  await db.insert(tables.zakatHistory).values({
    id,
    zakatDate: body.zakatDate ? new Date(body.zakatDate) : new Date(),
    inventoryValue: body.inventoryValue || 0,
    cashBalance: body.cashBalance || 0,
    receivables: body.receivables || 0,
    otherAssets: body.otherAssets || 0,
    totalAssets: body.totalAssets,
    shortTermLiabilities: body.shortTermLiabilities || 0,
    netZakatableAssets: body.netZakatableAssets,
    nisabAtTime: body.nisabAtTime,
    meetsNisab: body.meetsNisab,
    zakatAmount: body.zakatAmount,
    zakatRate: body.zakatRate || 2.5,
    isPaid: false,
    notes: body.notes,
    currency: body.currency || 'DZD',
  });

  // Fetch the created record
  const record = await db.query.zakatHistory.findFirst({
    where: eq(tables.zakatHistory.id, id),
  });

  return record;
});
