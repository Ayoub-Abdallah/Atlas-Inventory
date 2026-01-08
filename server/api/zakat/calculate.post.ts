import { eq, sum } from 'drizzle-orm';

interface CalculateZakatResponse {
  // Asset breakdown
  inventoryValue: number;
  cashBalance: number;
  receivables: number;
  otherAssets: number;
  totalAssets: number;
  // Liabilities
  shortTermLiabilities: number;
  // Net calculation
  netZakatableAssets: number;
  // Nisab comparison
  nisabValue: number;
  nisabGoldGrams: number;
  goldPricePerGram: number;
  meetsNisab: boolean;
  // Zakat due
  zakatRate: number;
  zakatAmount: number;
  // Currency
  currency: string;
  // Inventory details
  productCount: number;
}

export default defineEventHandler(async (): Promise<CalculateZakatResponse> => {
  const db = useDB();

  // Get Zakat settings
  let settings = await db.query.zakatSettings.findFirst({
    where: eq(tables.zakatSettings.id, 1),
  });

  // Create default settings if not exists
  if (!settings) {
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
    settings = await db.query.zakatSettings.findFirst({
      where: eq(tables.zakatSettings.id, 1),
    });
  }

  // Calculate inventory value at selling price (market value for Zakat)
  // Only count active products with stock
  const products = await db.query.products.findMany({
    where: eq(tables.products.isActive, true),
  });

  let inventoryValue = 0;
  let productCount = 0;

  for (const product of products) {
    const stockQty = product.stockQuantity || 0;
    const sellingPrice = product.sellingPrice || 0;
    
    if (stockQty > 0) {
      inventoryValue += stockQty * sellingPrice;
      productCount++;
    }
  }

  // Also include variant stock
  const variants = await db.query.productVariants.findMany();
  
  for (const variant of variants) {
    const stockQty = variant.stockQuantity || 0;
    const price = variant.price || 0;
    
    if (stockQty > 0) {
      inventoryValue += stockQty * price;
    }
  }

  // Get manual asset values from settings
  const cashBalance = settings?.cashBalance || 0;
  const receivables = settings?.receivables || 0;
  const otherAssets = settings?.otherAssets || 0;
  const shortTermLiabilities = settings?.shortTermLiabilities || 0;

  // Calculate totals
  const totalAssets = inventoryValue + cashBalance + receivables + otherAssets;
  const netZakatableAssets = totalAssets - shortTermLiabilities;

  // Get Nisab values
  const nisabGoldGrams = settings?.nisabGoldGrams || 85;
  const goldPricePerGram = settings?.goldPricePerGram || 0;
  const nisabValue = nisabGoldGrams * goldPricePerGram;

  // Check if Nisab is met
  const meetsNisab = nisabValue > 0 && netZakatableAssets >= nisabValue;

  // Calculate Zakat (2.5% if Nisab is met)
  const zakatRate = settings?.zakatRate || 2.5;
  const zakatAmount = meetsNisab ? (netZakatableAssets * zakatRate) / 100 : 0;

  // Update last calculated timestamp
  await db
    .update(tables.zakatSettings)
    .set({ lastCalculatedAt: new Date(), updatedAt: new Date() })
    .where(eq(tables.zakatSettings.id, 1));

  return {
    inventoryValue,
    cashBalance,
    receivables,
    otherAssets,
    totalAssets,
    shortTermLiabilities,
    netZakatableAssets,
    nisabValue,
    nisabGoldGrams,
    goldPricePerGram,
    meetsNisab,
    zakatRate,
    zakatAmount,
    currency: settings?.currency || 'DZD',
    productCount,
  };
});
