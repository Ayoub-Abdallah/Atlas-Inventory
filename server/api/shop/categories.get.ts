import { and, eq } from 'drizzle-orm';

/** Public category list with published-product counts (children roll up to parents). */
export default defineEventHandler(async () => {
  const db = useDB();

  const [cats, published] = await Promise.all([
    db.query.categories.findMany(),
    db
      .select({ categoryId: tables.products.categoryId })
      .from(tables.products)
      .where(
        and(
          eq(tables.products.published, true),
          eq(tables.products.isActive, true)
        )
      ),
  ]);

  const directCounts = new Map<string, number>();
  for (const p of published) {
    if (p.categoryId) {
      directCounts.set(p.categoryId, (directCounts.get(p.categoryId) || 0) + 1);
    }
  }

  const byId = new Map(cats.map((c) => [c.id, c]));
  const totals = new Map<string, number>();
  for (const [catId, count] of directCounts) {
    let current = byId.get(catId);
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      totals.set(current.id, (totals.get(current.id) || 0) + count);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
  }

  return cats
    .filter((c) => (totals.get(c.id) || 0) > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      color: c.color,
      parentId: c.parentId,
      count: totals.get(c.id) || 0,
    }))
    .sort((a, b) => b.count - a.count);
});
