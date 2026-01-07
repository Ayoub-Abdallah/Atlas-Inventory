import { eq } from 'drizzle-orm';
import { settings } from '~~/server/database/schema';

export default defineEventHandler(async (event) => {
  const db = useDB();

  // Try to find the settings row (ID 1)
  const [existingSettings] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);

  if (existingSettings) {
    return existingSettings;
  }

  // If not found, create default
  const [newSettings] = await db.insert(settings).values({
    id: 1,
    businessName: 'Atlas Inventory',
    currency: 'DZD',
    defaultMargin: 30,
    lowStockAlert: true,
    outOfStockAlert: true,
    emailDailyReport: false,
    language: 'fr',
    theme: 'default',
    invoiceTemplate: null,
  }).returning();

  return newSettings;
});
