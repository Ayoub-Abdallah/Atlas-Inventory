import { and, eq, inArray, ne } from 'drizzle-orm';
import {
  shopProductWith,
  toShopCard,
  toShopDetail,
} from '../../../utils/shop';

/** Public product detail + recommended rail (manual picks, then auto fallback). */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!;
  const db = useDB();

  const product = await db.query.products.findFirst({
    where: and(
      eq(tables.products.slug, slug),
      eq(tables.products.published, true),
      eq(tables.products.isActive, true)
    ),
    with: shopProductWith,
  });

  if (!product) {
    throw createError({ statusCode: 404, message: 'Product not found' });
  }

  const detail = toShopDetail(product);

  // Recommended products: manual picks first, auto-filled with same-category
  // products closest in price when fewer than 4 picks exist.
  const manualIds: string[] = Array.isArray(product.relatedProducts)
    ? (product.relatedProducts as string[])
    : [];

  const related = [];
  if (manualIds.length > 0) {
    const manual = await db.query.products.findMany({
      where: and(
        inArray(tables.products.id, manualIds),
        eq(tables.products.published, true),
        eq(tables.products.isActive, true)
      ),
      with: shopProductWith,
    });
    // Preserve the admin's chosen order
    manual.sort((a, b) => manualIds.indexOf(a.id) - manualIds.indexOf(b.id));
    related.push(...manual.map(toShopCard));
  }

  if (related.length < 4 && product.categoryId) {
    const sameCategory = await db.query.products.findMany({
      where: and(
        eq(tables.products.categoryId, product.categoryId),
        eq(tables.products.published, true),
        eq(tables.products.isActive, true),
        ne(tables.products.id, product.id)
      ),
      with: shopProductWith,
    });
    const seen = new Set(related.map((r) => r.id));
    const fallback = sameCategory
      .map(toShopCard)
      .filter((c) => !seen.has(c.id))
      .sort(
        (a, b) =>
          Math.abs(a.price - detail.price) - Math.abs(b.price - detail.price)
      );
    related.push(...fallback.slice(0, 8 - related.length));
  }

  return { product: detail, related: related.slice(0, 8) };
});
