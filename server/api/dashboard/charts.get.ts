import { sql, eq, desc } from 'drizzle-orm';

export default defineEventHandler(async () => {
  const db = useDB();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoSec = Math.floor(thirtyDaysAgo.getTime() / 1000);

  console.log('[dashboard/charts] 30 days ago:', thirtyDaysAgo.toISOString(), 'seconds:', thirtyDaysAgoSec);

  const movementsByDay = await db
    .select({
      // treat createdAt as seconds since epoch in SQL
      date: sql<string>`date(${tables.stockMovements.createdAt}, 'unixepoch')`,
      type: tables.stockMovements.type,
      totalQuantity: sql<number>`SUM(ABS(${tables.stockMovements.quantity}))`,
    })
    .from(tables.stockMovements)
    .where(sql`${tables.stockMovements.createdAt} >= ${thirtyDaysAgoSec}`)
    .groupBy(
      sql`date(${tables.stockMovements.createdAt}, 'unixepoch')`,
      tables.stockMovements.type
    )
    .orderBy(sql`date(${tables.stockMovements.createdAt}, 'unixepoch')`);

  console.log('[dashboard/charts] movementsByDay:', movementsByDay.length, 'rows');

  const movementsChartData = processMovementsByDay(movementsByDay);

  const productsByCategory = await db
    .select({
      categoryId: tables.products.categoryId,
      categoryName: tables.categories.name,
      categoryColor: tables.categories.color,
      count: sql<number>`count(*)`,
    })
    .from(tables.products)
    .leftJoin(
      tables.categories,
      eq(tables.products.categoryId, tables.categories.id)
    )
    .where(eq(tables.products.isActive, true))
    .groupBy(
      tables.products.categoryId,
      tables.categories.name,
      tables.categories.color
    );

  console.log('[dashboard/charts] productsByCategory:', productsByCategory.length, 'rows');

  const topProductsByValue = await db
    .select({
      id: tables.products.id,
      name: tables.products.name,
      stockValue: sql<number>`${tables.products.costPrice} * ${tables.products.stockQuantity}`,
    })
    .from(tables.products)
    .where(eq(tables.products.isActive, true))
    .orderBy(
      desc(sql`${tables.products.costPrice} * ${tables.products.stockQuantity}`)
    )
    .limit(10);

  const stockLevelsResult = await db
    .select({
      stockStatus: sql<string>`
        CASE 
          WHEN ${tables.products.stockQuantity} = 0 THEN 'out_of_stock'
          WHEN ${tables.products.stockQuantity} <= ${tables.products.stockMin} THEN 'low_stock'
          WHEN ${tables.products.stockMax} IS NOT NULL AND ${tables.products.stockQuantity} >= ${tables.products.stockMax} THEN 'overstock'
          ELSE 'normal'
        END
      `,
      count: sql<number>`count(*)`,
    })
    .from(tables.products)
    .where(eq(tables.products.isActive, true)).groupBy(sql`
      CASE 
        WHEN ${tables.products.stockQuantity} = 0 THEN 'out_of_stock'
        WHEN ${tables.products.stockQuantity} <= ${tables.products.stockMin} THEN 'low_stock'
        WHEN ${tables.products.stockMax} IS NOT NULL AND ${tables.products.stockQuantity} >= ${tables.products.stockMax} THEN 'overstock'
        ELSE 'normal'
      END
    `);

  const movementsByType = await db
    .select({
      type: tables.stockMovements.type,
      count: sql<number>`count(*)`,
      totalQuantity: sql<number>`SUM(ABS(${tables.stockMovements.quantity}))`,
    })
    .from(tables.stockMovements)
    .where(sql`${tables.stockMovements.createdAt} >= ${thirtyDaysAgoSec}`)
    .groupBy(tables.stockMovements.type);

  return {
    movementsChart: movementsChartData,
    productsByCategory,
    topProductsByValue,
    stockLevels: stockLevelsResult,
    movementsByType,
  };
});

function processMovementsByDay(
  movements: { date: string; type: string; totalQuantity: number }[]
) {
  const dateMap = new Map<string, { in: number; out: number }>();

  const dates: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    dates.push(dateStr);
    dateMap.set(dateStr, { in: 0, out: 0 });
  }

  for (const m of movements) {
    if (dateMap.has(m.date)) {
      const existing = dateMap.get(m.date)!;
      // Categorize based on type AND quantity sign
      // 'in' and 'return' are stock in (positive quantities)
      // 'out', 'sale', and negative adjustments are stock out
      if (m.type === 'in' || m.type === 'return' || (m.type === 'adjustment' && m.totalQuantity > 0)) {
        existing.in += m.totalQuantity;
      } else if (m.type === 'out' || m.type === 'sale' || (m.type === 'adjustment' && m.totalQuantity < 0)) {
        existing.out += m.totalQuantity;
      }
    }
  }

  const labels = dates.map((d) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const stockIn = dates.map((d) => dateMap.get(d)?.in || 0);
  const stockOut = dates.map((d) => dateMap.get(d)?.out || 0);

  return { labels, stockIn, stockOut };
}
