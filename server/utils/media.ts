import { asc, eq } from 'drizzle-orm';
import { mediaAssets } from '../database/schema';
import type { MediaAsset } from '../database/schema';

export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
];
export const DOCUMENT_MIME_TYPES = ['application/pdf'];

export const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8 MB
export const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25 MB

export function mediaKindForMime(mime: string): 'image' | 'document' | null {
  if (IMAGE_MIME_TYPES.includes(mime)) return 'image';
  if (DOCUMENT_MIME_TYPES.includes(mime)) return 'document';
  return null;
}

function sanitizeFilename(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'file';
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  return ext ? `${base}.${ext}` : base;
}

/**
 * Store a file in blob storage (R2 in production, local disk in dev) and
 * record it as a media asset of the product. Returns the created row.
 */
export async function storeProductMedia(opts: {
  productId: string;
  data: Blob | ArrayBuffer;
  filename: string;
  mimeType: string;
  alt?: string;
  sortOrder?: number;
}): Promise<MediaAsset> {
  const kind = mediaKindForMime(opts.mimeType);
  if (!kind) {
    throw createError({
      statusCode: 415,
      message: `Unsupported file type: ${opts.mimeType}. Allowed: images (jpeg, png, webp, gif, avif) and PDF.`,
    });
  }

  const blob = opts.data instanceof Blob
    ? opts.data
    : new Blob([opts.data], { type: opts.mimeType });

  const maxSize = kind === 'image' ? MAX_IMAGE_SIZE : MAX_DOCUMENT_SIZE;
  if (blob.size > maxSize) {
    throw createError({
      statusCode: 413,
      message: `File too large (${Math.round(blob.size / 1024 / 1024)} MB). Max ${Math.round(maxSize / 1024 / 1024)} MB.`,
    });
  }

  const safeName = sanitizeFilename(opts.filename);
  const pathname = `products/${opts.productId}/${crypto.randomUUID().slice(0, 8)}-${safeName}`;

  await hubBlob().put(pathname, blob, {
    contentType: opts.mimeType,
    addRandomSuffix: false,
  });

  const db = useDB();

  let sortOrder = opts.sortOrder;
  if (sortOrder === undefined) {
    const existing = await db
      .select({ sortOrder: mediaAssets.sortOrder })
      .from(mediaAssets)
      .where(eq(mediaAssets.productId, opts.productId))
      .orderBy(asc(mediaAssets.sortOrder));
    sortOrder = existing.length > 0
      ? Math.max(...existing.map((m) => m.sortOrder ?? 0)) + 1
      : 0;
  }

  const [asset] = await db
    .insert(mediaAssets)
    .values({
      id: generateId('media'),
      productId: opts.productId,
      kind,
      pathname,
      url: `/media/${pathname}`,
      filename: opts.filename,
      mimeType: opts.mimeType,
      size: blob.size,
      alt: opts.alt,
      sortOrder,
    })
    .returning();

  return asset!;
}

/** Delete a media asset row and its blob object. */
export async function deleteProductMedia(asset: MediaAsset): Promise<void> {
  const db = useDB();
  await db.delete(mediaAssets).where(eq(mediaAssets.id, asset.id));
  try {
    await hubBlob().del(asset.pathname);
  } catch {
    // Blob already gone; the DB row removal is what matters
  }
}
