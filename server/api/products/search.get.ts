import { like, or, eq, desc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);

  const searchTerm = (query.q as string) || '';
  const barcode = query.barcode as string;
  const limit = parseInt(query.limit as string) || 20;

  // If searching by barcode specifically
  if (barcode) {
    // First, search in products
    const product = await db.query.products.findFirst({
      where: eq(tables.products.barcode, barcode),
      with: {
        category: true,
        supplier: true,
        tax: true,
        variants: true,
      },
    });

    if (product) {
      return [product];
    }

    // Then search in variants
    const variant = await db.query.productVariants.findFirst({
      where: eq(tables.productVariants.barcode, barcode),
      with: {
        product: {
          with: {
            category: true,
            supplier: true,
            tax: true,
          },
        },
        supplier: true,
        tax: true,
      },
    });

    if (variant) {
      // Return the parent product with this variant highlighted
      return [{
        ...variant.product,
        matchedVariant: variant,
        variants: [variant],
      }];
    }

    return [];
  }

  // General search by name, SKU, or barcode
  if (!searchTerm || searchTerm.length < 2) {
    // Return recent products if no search term
    const products = await db.query.products.findMany({
      limit,
      orderBy: [desc(tables.products.updatedAt)],
      with: {
        category: true,
        supplier: true,
        tax: true,
        variants: true,
      },
    });
    return products;
  }

  const searchPattern = `%${searchTerm}%`;

  const products = await db.query.products.findMany({
    where: or(
      like(tables.products.name, searchPattern),
      like(tables.products.sku, searchPattern),
      like(tables.products.barcode, searchPattern)
    ),
    limit,
    orderBy: [desc(tables.products.updatedAt)],
    with: {
      category: true,
      supplier: true,
      tax: true,
      variants: true,
    },
  });

  // Also search in variants
  const variants = await db.query.productVariants.findMany({
    where: or(
      like(tables.productVariants.name, searchPattern),
      like(tables.productVariants.sku, searchPattern),
      like(tables.productVariants.barcode, searchPattern)
    ),
    limit,
    with: {
      product: {
        with: {
          category: true,
          supplier: true,
          tax: true,
        },
      },
    },
  });

  // Merge results, avoiding duplicates
  const productIds = new Set(products.map(p => p.id));
  
  for (const variant of variants) {
    if (variant.product && !productIds.has(variant.product.id)) {
      products.push({
        ...variant.product,
        matchedVariant: variant,
        variants: [variant],
      } as typeof products[0]);
      productIds.add(variant.product.id);
    }
  }

  return products.slice(0, limit);
});
