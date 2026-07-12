import { eq } from 'drizzle-orm';

/** Public storefront configuration (safe subset of settings). */
export default defineEventHandler(async () => {
  const db = useDB();
  const settings = await db.query.settings.findFirst({
    where: eq(tables.settings.id, 1),
  });

  return {
    businessName: settings?.businessName || 'Atlas',
    currency: settings?.currency || 'DZD',
    storePhone: settings?.storePhone || null,
    storeAddress: settings?.storeAddress || null,
    phoneCountryCode: settings?.phoneCountryCode || '+213',
    siteUrl: settings?.siteUrl || null,
  };
});
