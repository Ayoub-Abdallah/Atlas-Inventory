import { and, eq, like, or } from 'drizzle-orm';
import { shopProductWith, toShopCard, productPrice } from '../../../utils/shop';

/**
 * Public catalog. Query params:
 *   q, category (slug), brand, minPrice, maxPrice,
 *   sort = new | price-asc | price-desc | name, page, perPage
 * Returns items + facets (brands, price range) computed on the filtered set.
 */
export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);

  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 80) : '';
  const categorySlug = typeof query.category === 'string' ? query.category : '';
  const brand = typeof query.brand === 'string' ? query.brand : '';
  const minPrice = query.minPrice !== undefined ? Number(query.minPrice) : null;
  const maxPrice = query.maxPrice !== undefined ? Number(query.maxPrice) : null;
  const sort = typeof query.sort === 'string' ? query.sort : 'new';
  const page = Math.max(1, Number(query.page) || 1);
  const perPage = Math.min(48, Math.max(1, Number(query.perPage) || 12));

  // Resolve category slug to the category and its direct children
  let categoryIds: string[] | null = null;
  if (categorySlug) {
    const category = await db.query.categories.findFirst({
      where: eq(tables.categories.slug, categorySlug),
      with: { children: true },
    });
    if (!category) {
      return { items: [], total: 0, page, perPage, facets: { brands: [], price: null }, category: null };
    }
    categoryIds = [category.id, ...category.children.map((c) => c.id)];
  }

  const conditions = [
    eq(tables.products.published, true),
    eq(tables.products.isActive, true),
  ];
  if (q) {
    conditions.push(
      or(
        like(tables.products.name, `%${q}%`),
        like(tables.products.brand, `%${q}%`),
        like(tables.products.description, `%${q}%`)
      )!
    );
  }

  let rows = await db.query.products.findMany({
    where: and(...conditions),
    with: shopProductWith,
  });

  if (categoryIds) {
    rows = rows.filter((p) => p.categoryId && categoryIds!.includes(p.categoryId));
  }

  // Facets reflect the query+category scope (before brand/price narrowing)
  const brandCounts = new Map<string, number>();
  let priceMin = Infinity;
  let priceMax = -Infinity;
  for (const p of rows) {
    if (p.brand) brandCounts.set(p.brand, (brandCounts.get(p.brand) || 0) + 1);
    const { price } = productPrice(p);
    if (price < priceMin) priceMin = price;
    if (price > priceMax) priceMax = price;
  }

  if (brand) rows = rows.filter((p) => p.brand === brand);
  if (minPrice !== null && !Number.isNaN(minPrice)) {
    rows = rows.filter((p) => productPrice(p).price >= minPrice);
  }
  if (maxPrice !== null && !Number.isNaN(maxPrice)) {
    rows = rows.filter((p) => productPrice(p).price <= maxPrice);
  }

  const cards = rows.map(toShopCard);
  switch (sort) {
    case 'price-asc':
      cards.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      cards.sort((a, b) => b.price - a.price);
      break;
    case 'name':
      cards.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default: // 'new'
      cards.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
  }

  const total = cards.length;
  const items = cards.slice((page - 1) * perPage, page * perPage);

  let categoryInfo = null;
  if (categorySlug && categoryIds) {
    const cat = await db.query.categories.findFirst({
      where: eq(tables.categories.slug, categorySlug),
    });
    if (cat) {
      categoryInfo = { id: cat.id, name: cat.name, slug: cat.slug, description: cat.description };
    }
  }

  return {
    items,
    total,
    page,
    perPage,
    category: categoryInfo,
    facets: {
      brands: [...brandCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      price:
        priceMin !== Infinity ? { min: priceMin, max: priceMax } : null,
    },
  };
});
