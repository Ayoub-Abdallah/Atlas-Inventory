import { eq } from 'drizzle-orm';

interface UpdateZakatSettingsBody {
  nisabGoldGrams?: number;
  goldPricePerGram?: number;
  currency?: string;
  zakatRate?: number;
  cashBalance?: number;
  receivables?: number;
  otherAssets?: number;
  shortTermLiabilities?: number;
  hawlStartDate?: string | Date;
}

export default defineEventHandler(async (event) => {
  const db = useDB();
  const body = await readBody<UpdateZakatSettingsBody>(event);

  // Calculate nisab value if gold price is provided
  const nisabGoldGrams = body.nisabGoldGrams ?? 85;
  const goldPricePerGram = body.goldPricePerGram ?? 0;
  const nisabValue = nisabGoldGrams * goldPricePerGram;

  // Ensure settings exist first
  const existing = await db.query.zakatSettings.findFirst({
    where: eq(tables.zakatSettings.id, 1),
  });

  if (!existing) {
    // Create initial settings
    await db.insert(tables.zakatSettings).values({
      id: 1,
      nisabGoldGrams,
      goldPricePerGram,
      nisabValue,
      currency: body.currency || 'DZD',
      zakatRate: body.zakatRate ?? 2.5,
      cashBalance: body.cashBalance ?? 0,
      receivables: body.receivables ?? 0,
      otherAssets: body.otherAssets ?? 0,
      shortTermLiabilities: body.shortTermLiabilities ?? 0,
      hawlStartDate: body.hawlStartDate ? new Date(body.hawlStartDate) : null,
    });
  } else {
    // Update existing settings
    await db
      .update(tables.zakatSettings)
      .set({
        nisabGoldGrams: body.nisabGoldGrams ?? existing.nisabGoldGrams,
        goldPricePerGram: body.goldPricePerGram ?? existing.goldPricePerGram,
        nisabValue,
        currency: body.currency ?? existing.currency,
        zakatRate: body.zakatRate ?? existing.zakatRate,
        cashBalance: body.cashBalance ?? existing.cashBalance,
        receivables: body.receivables ?? existing.receivables,
        otherAssets: body.otherAssets ?? existing.otherAssets,
        shortTermLiabilities: body.shortTermLiabilities ?? existing.shortTermLiabilities,
        hawlStartDate: body.hawlStartDate ? new Date(body.hawlStartDate) : existing.hawlStartDate,
        updatedAt: new Date(),
      })
      .where(eq(tables.zakatSettings.id, 1));
  }

  // Return updated settings
  const updated = await db.query.zakatSettings.findFirst({
    where: eq(tables.zakatSettings.id, 1),
  });

  return updated;
});
