import { and, eq } from 'drizzle-orm';

/** Sitemap for the public storefront: landing, shop, categories, products. */
export default defineEventHandler(async (event) => {
  const db = useDB();

  const [settings, products, categories] = await Promise.all([
    db.query.settings.findFirst({ where: eq(tables.settings.id, 1) }),
    db.query.products.findMany({
      where: and(
        eq(tables.products.published, true),
        eq(tables.products.isActive, true)
      ),
      columns: { slug: true, updatedAt: true },
    }),
    db.query.categories.findMany({ columns: { slug: true } }),
  ]);

  const base =
    settings?.siteUrl?.replace(/\/$/, '') ||
    getRequestURL(event).origin;

  const urls: Array<{ loc: string; lastmod?: string; priority: string }> = [
    { loc: `${base}/`, priority: '1.0' },
    { loc: `${base}/shop`, priority: '0.9' },
  ];
  for (const c of categories) {
    if (c.slug) urls.push({ loc: `${base}/category/${c.slug}`, priority: '0.7' });
  }
  for (const p of products) {
    if (p.slug) {
      urls.push({
        loc: `${base}/product/${p.slug}`,
        lastmod: p.updatedAt ? new Date(p.updatedAt).toISOString().slice(0, 10) : undefined,
        priority: '0.8',
      });
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`
  )
  .join('\n')}
</urlset>`;

  setHeader(event, 'Content-Type', 'application/xml');
  setHeader(event, 'Cache-Control', 'public, max-age=3600');
  return xml;
});
