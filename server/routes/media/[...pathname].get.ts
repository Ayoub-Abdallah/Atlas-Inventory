/**
 * Public media serving route: /media/products/<id>/<file>
 * Streams objects from blob storage (Cloudflare R2 in production,
 * local disk in development) with long-lived cache headers; object
 * keys contain a random component so they are immutable.
 */
export default defineEventHandler(async (event) => {
  const pathname = getRouterParam(event, 'pathname');
  if (!pathname || pathname.includes('..')) {
    throw createError({ statusCode: 400, message: 'Invalid media path' });
  }

  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable');
  return hubBlob().serve(event, pathname);
});
