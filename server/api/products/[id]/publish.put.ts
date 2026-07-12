import { eq } from 'drizzle-orm';

/** Toggle storefront visibility. Body: { published: boolean } */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!;
  const body = await readBody(event);
  const published = !!body?.published;
  const db = useDB();

  const product = await db.query.products.findFirst({
    where: eq(tables.products.id, id),
    columns: { id: true, name: true, slug: true, published: true },
  });
  if (!product) {
    throw createError({ statusCode: 404, message: 'Product not found' });
  }

  // Products created before the storefront may not have a slug yet
  const slug = product.slug || (await uniqueProductSlug(product.name, id));

  await db
    .update(tables.products)
    .set({
      published,
      slug,
      publishedAt: published && !product.published ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(tables.products.id, id));

  return { success: true, published, slug };
});
