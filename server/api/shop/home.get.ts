import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { shopProductWith, toShopCard } from '../../utils/shop';

/**
 * Landing/home data: best sellers (by confirmed sale quantities),
 * new arrivals, and top categories. One round trip for the landing page.
 */
export default defineEventHandler(async () => {
  const db = useDB();

  // Best sellers from confirmed sales
  const sold = await db
    .select({
      productId: tables.saleItems.productId,
      totalSold: sql<number>`sum(${tables.saleItems.quantity})`.as('total_sold'),
    })
    .from(tables.saleItems)
    .innerJoin(tables.sales, eq(tables.saleItems.saleId, tables.sales.id))
    .where(eq(tables.sales.status, 'confirmed'))
    .groupBy(tables.saleItems.productId)
    .orderBy(desc(sql`total_sold`))
    .limit(24);

  const soldIds = sold.map((s) => s.productId);
  const soldRank = new Map(soldIds.map((id, i) => [id, i]));

  let bestSellers: ReturnType<typeof toShopCard>[] = [];
  if (soldIds.length > 0) {
    const rows = await db.query.products.findMany({
      where: and(
        inArray(tables.products.id, soldIds),
        eq(tables.products.published, true),
        eq(tables.products.isActive, true)
      ),
      with: shopProductWith,
    });
    bestSellers = rows
      .sort((a, b) => (soldRank.get(a.id) ?? 99) - (soldRank.get(b.id) ?? 99))
      .slice(0, 8)
      .map(toShopCard);
  }

  const newest = await db.query.products.findMany({
    where: and(
      eq(tables.products.published, true),
      eq(tables.products.isActive, true)
    ),
    with: shopProductWith,
    orderBy: [desc(tables.products.createdAt)],
    limit: 12,
  });
  const newArrivals = newest.map(toShopCard);

  // Fill best sellers with new arrivals when sales history is thin
  if (bestSellers.length < 4) {
    const seen = new Set(bestSellers.map((c) => c.id));
    bestSellers.push(
      ...newArrivals.filter((c) => !seen.has(c.id)).slice(0, 8 - bestSellers.length)
    );
  }

  const categories = await $fetch('/api/shop/categories');

  return {
    bestSellers,
    newArrivals: newArrivals.slice(0, 8),
    categories: categories.slice(0, 6),
  };
});
