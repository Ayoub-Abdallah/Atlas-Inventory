import { eq } from 'drizzle-orm';

export default defineEventHandler(async () => {
  const db = useDB();

  // Get or create zakat settings (singleton with ID 1)
  let zakatSettings = await db.query.zakatSettings.findFirst({
    where: eq(tables.zakatSettings.id, 1),
  });

  // If no settings exist, create default settings
  if (!zakatSettings) {
    await db.insert(tables.zakatSettings).values({
      id: 1,
      nisabGoldGrams: 85,
      goldPricePerGram: 0,
      nisabValue: 0,
      currency: 'DZD',
      zakatRate: 2.5,
      cashBalance: 0,
      receivables: 0,
      otherAssets: 0,
      shortTermLiabilities: 0,
    });

    zakatSettings = await db.query.zakatSettings.findFirst({
      where: eq(tables.zakatSettings.id, 1),
    });
  }

  return zakatSettings;
});
