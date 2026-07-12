import { and, eq } from 'drizzle-orm';
import { deleteProductMedia } from '../../../../utils/media';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!;
  const mediaId = getRouterParam(event, 'mediaId')!;
  const db = useDB();

  const asset = await db.query.mediaAssets.findFirst({
    where: and(
      eq(tables.mediaAssets.id, mediaId),
      eq(tables.mediaAssets.productId, id)
    ),
  });
  if (!asset) {
    throw createError({ statusCode: 404, message: 'Media asset not found' });
  }

  await deleteProductMedia(asset);
  return { success: true };
});
