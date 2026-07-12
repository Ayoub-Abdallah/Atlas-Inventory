import { eq } from 'drizzle-orm';
import { storeProductMedia } from '../../../utils/media';

/**
 * Upload one or more gallery images / technical PDFs for a product.
 * Multipart form: files under the "files" field.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!;
  const db = useDB();

  const product = await db.query.products.findFirst({
    where: eq(tables.products.id, id),
    columns: { id: true, name: true },
  });
  if (!product) {
    throw createError({ statusCode: 404, message: 'Product not found' });
  }

  const form = await readFormData(event);
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    throw createError({ statusCode: 400, message: 'No files provided' });
  }

  const created = [];
  for (const file of files) {
    created.push(
      await storeProductMedia({
        productId: id,
        data: file,
        filename: file.name,
        mimeType: file.type,
        alt: product.name,
      })
    );
  }

  return created;
});
