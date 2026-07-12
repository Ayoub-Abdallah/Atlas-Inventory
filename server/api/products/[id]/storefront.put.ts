import { eq } from 'drizzle-orm';

/**
 * Update only the storefront-facing fields of a product without touching
 * inventory data. Body: { brand?, specs?, relatedProducts?, published? }
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!;
  const body = await readBody(event);
  const db = useDB();

  const product = await db.query.products.findFirst({
    where: eq(tables.products.id, id),
    columns: { id: true, name: true, slug: true, published: true },
  });
  if (!product) {
    throw createError({ statusCode: 404, message: 'Product not found' });
  }

  // Validate specs shape: array of { key, value }
  let specs: Array<{ key: string; value: string }> | null | undefined;
  if (body.specs !== undefined) {
    if (body.specs === null) {
      specs = null;
    } else if (Array.isArray(body.specs)) {
      specs = body.specs
        .filter((s: any) => s && typeof s.key === 'string' && s.key.trim())
        .map((s: any) => ({
          key: String(s.key).trim().slice(0, 80),
          value: String(s.value ?? '').trim().slice(0, 500),
        }));
    } else {
      throw createError({ statusCode: 400, message: 'specs must be a list of key/value pairs' });
    }
  }

  let relatedProducts: string[] | null | undefined;
  if (body.relatedProducts !== undefined) {
    relatedProducts = Array.isArray(body.relatedProducts)
      ? body.relatedProducts.filter((r: any) => typeof r === 'string' && r !== id).slice(0, 12)
      : null;
  }

  const published =
    body.published !== undefined ? !!body.published : undefined;
  const slug = product.slug || (await uniqueProductSlug(product.name, id));

  await db
    .update(tables.products)
    .set({
      slug,
      brand: body.brand !== undefined ? body.brand?.trim() || null : undefined,
      description:
        body.description !== undefined ? body.description || null : undefined,
      specs,
      relatedProducts,
      published,
      publishedAt:
        published && !product.published ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(tables.products.id, id));

  return { success: true, slug };
});
