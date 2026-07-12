import { eq, sql } from 'drizzle-orm';
import { storeProductMedia } from '../../utils/media';
import { slugify } from '../../utils/slug';

interface ImportRow {
  line: number;
  name?: string;
  sku?: string;
  category?: string;
  brand?: string;
  price?: number;
  costPrice?: number;
  quantity?: number;
  description?: string;
  specs?: Array<{ key: string; value: string }>;
  imagePaths?: string[];
  technicalFilePaths?: string[];
  relatedSkus?: string[];
  published?: boolean;
}

interface RowResult {
  line: number;
  name: string;
  status: 'created' | 'updated' | 'skipped';
  productId?: string;
  errors: string[];
  mediaUploaded: number;
  mediaFailed: string[];
  pendingLocalFiles: string[];
}

const MAX_ROWS_PER_REQUEST = 25;

function isUrl(path: string): boolean {
  return /^https?:\/\//i.test(path);
}

/** Download a remote image/PDF and attach it to the product. */
async function importRemoteFile(
  productId: string,
  url: string
): Promise<void> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || '';
  const data = await res.arrayBuffer();
  const filename = decodeURIComponent(
    new URL(url).pathname.split('/').pop() || 'file'
  );
  await storeProductMedia({ productId, data, filename, mimeType: mime });
}

/**
 * Bulk import from the admin Excel importer. The client parses the .xlsx,
 * validates, and sends normalized rows in small batches. Local file paths
 * come back as pendingLocalFiles: the client matches them against the
 * files the admin dropped and uploads them through the media endpoint.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const rows: ImportRow[] = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0 || rows.length > MAX_ROWS_PER_REQUEST) {
    throw createError({
      statusCode: 400,
      message: `rows must contain 1 to ${MAX_ROWS_PER_REQUEST} entries`,
    });
  }

  const db = useDB();
  const results: RowResult[] = [];

  // Category cache (name, lowercased -> id), creating missing ones once
  const allCategories = await db.query.categories.findMany();
  const categoryByName = new Map(
    allCategories.map((c) => [c.name.trim().toLowerCase(), c])
  );

  async function resolveCategory(name: string): Promise<string> {
    const key = name.trim().toLowerCase();
    const existing = categoryByName.get(key);
    if (existing) return existing.id;

    const id = generateId('cat');
    const base = slugify(name);
    const used = new Set(allCategories.map((c) => c.slug));
    let slug = base;
    for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;

    await db.insert(tables.categories).values({ id, name: name.trim(), slug });
    const created = { id, name: name.trim(), slug } as (typeof allCategories)[number];
    allCategories.push(created);
    categoryByName.set(key, created);
    return id;
  }

  for (const row of rows) {
    const result: RowResult = {
      line: row.line,
      name: row.name || '',
      status: 'skipped',
      errors: [],
      mediaUploaded: 0,
      mediaFailed: [],
      pendingLocalFiles: [],
    };
    results.push(result);

    // Required fields: name, price, category
    const name = row.name?.trim();
    if (!name) result.errors.push('missing_name');
    const price = Number(row.price);
    if (row.price === undefined || Number.isNaN(price) || price < 0) {
      result.errors.push('invalid_price');
    }
    if (!row.category?.trim()) result.errors.push('missing_category');
    if (result.errors.length > 0) continue;

    try {
      const categoryId = await resolveCategory(row.category!);

      // Match existing product by SKU first, then exact name
      let existing = row.sku
        ? await db.query.products.findFirst({
            where: eq(tables.products.sku, row.sku),
          })
        : undefined;
      if (!existing) {
        existing = await db.query.products.findFirst({
          where: sql`lower(${tables.products.name}) = ${name!.toLowerCase()}`,
        });
      }

      const specs =
        row.specs && row.specs.length > 0 ? row.specs : undefined;
      const published = row.published ?? false;

      let productId: string;
      if (existing) {
        productId = existing.id;
        await db
          .update(tables.products)
          .set({
            name: name!,
            sku: row.sku || existing.sku,
            categoryId,
            brand: row.brand?.trim() || existing.brand,
            sellingPrice: price,
            costPrice: row.costPrice ?? existing.costPrice,
            stockQuantity: row.quantity ?? existing.stockQuantity,
            description: row.description ?? existing.description,
            specs: specs ?? existing.specs,
            published: row.published ?? existing.published,
            publishedAt:
              published && !existing.published ? new Date() : undefined,
            slug: existing.slug || (await uniqueProductSlug(name!, existing.id)),
            updatedAt: new Date(),
          })
          .where(eq(tables.products.id, existing.id));
        result.status = 'updated';
      } else {
        productId = generateId('prod');
        await db.insert(tables.products).values({
          id: productId,
          name: name!,
          sku: row.sku || null,
          categoryId,
          brand: row.brand?.trim() || null,
          sellingPrice: price,
          costPrice: row.costPrice ?? 0,
          stockQuantity: row.quantity ?? 0,
          description: row.description || null,
          specs: specs ?? null,
          published,
          publishedAt: published ? new Date() : null,
          slug: await uniqueProductSlug(name!),
          isActive: true,
        });
        result.status = 'created';
      }
      result.productId = productId;

      // Media: URLs are fetched server-side; local paths go back to the client
      const allPaths = [
        ...(row.imagePaths || []),
        ...(row.technicalFilePaths || []),
      ];
      for (const path of allPaths) {
        const trimmed = path.trim();
        if (!trimmed) continue;
        if (isUrl(trimmed)) {
          try {
            await importRemoteFile(productId, trimmed);
            result.mediaUploaded++;
          } catch (e: any) {
            result.mediaFailed.push(`${trimmed}: ${e?.message || 'failed'}`);
          }
        } else {
          result.pendingLocalFiles.push(trimmed);
        }
      }
    } catch (e: any) {
      result.errors.push(e?.message || 'import_failed');
      result.status = 'skipped';
    }
  }

  // Second pass: resolve related product SKUs across the whole catalog
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const result = results[i]!;
    if (!result.productId || !row.relatedSkus?.length) continue;

    const relatedIds: string[] = [];
    for (const sku of row.relatedSkus) {
      const trimmed = sku.trim();
      if (!trimmed) continue;
      const related = await db.query.products.findFirst({
        where: eq(tables.products.sku, trimmed),
        columns: { id: true },
      });
      if (related && related.id !== result.productId) {
        relatedIds.push(related.id);
      } else if (!related) {
        result.mediaFailed.push(`related_sku_not_found: ${trimmed}`);
      }
    }
    if (relatedIds.length > 0) {
      await db
        .update(tables.products)
        .set({ relatedProducts: relatedIds, updatedAt: new Date() })
        .where(eq(tables.products.id, result.productId));
    }
  }

  return { results };
});
