export default defineEventHandler(async (event) => {
  const db = useDB();
  const body = await readBody(event);

  const id = generateId('cat');

  // Unique category slug for /category/[slug] storefront pages
  const base = slugify(body.name);
  const taken = await db.select({ slug: tables.categories.slug }).from(tables.categories);
  const used = new Set(taken.map((r) => r.slug));
  let slug = base;
  for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;

  await db.insert(tables.categories).values({
    id,
    name: body.name,
    slug,
    description: body.description || null,
    parentId: body.parentId || null,
    color: body.color || '#6B7280',
  });

  return { id };
});
