import type {
  Category,
  MediaAsset,
  Product,
  ProductVariant,
} from '../database/schema';

/**
 * Public DTO mapping for the storefront. Cost prices, margins and supplier
 * information must never leave the admin API; everything returned from
 * /api/shop/* goes through these mappers.
 */

export interface ShopImage {
  url: string;
  alt: string | null;
}

export interface ShopDocument {
  url: string;
  filename: string;
  size: number | null;
}

export interface ShopVariant {
  id: string;
  name: string;
  price: number;
  inStock: boolean;
  stockQuantity: number;
}

export interface ShopProductCard {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  price: number;
  priceFrom: boolean;
  inStock: boolean;
  stockQuantity: number;
  image: ShopImage | null;
  category: { id: string; name: string; slug: string | null } | null;
  createdAt: Date | null;
}

type ProductWithShopRelations = Product & {
  category?: Category | null;
  media?: MediaAsset[];
  variants?: ProductVariant[];
};

export function productStock(p: ProductWithShopRelations): number {
  if (p.variants && p.variants.length > 0) {
    return p.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
  }
  return p.stockQuantity || 0;
}

export function productPrice(p: ProductWithShopRelations): {
  price: number;
  priceFrom: boolean;
} {
  if (p.variants && p.variants.length > 0) {
    const prices = p.variants.map((v) => v.price).filter((x) => x > 0);
    if (prices.length > 0) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      return { price: min, priceFrom: min !== max };
    }
  }
  return { price: p.sellingPrice || 0, priceFrom: false };
}

export function toShopCard(p: ProductWithShopRelations): ShopProductCard {
  const images = (p.media || [])
    .filter((m) => m.kind === 'image')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const { price, priceFrom } = productPrice(p);
  const stock = productStock(p);

  return {
    id: p.id,
    slug: p.slug!,
    name: p.name,
    brand: p.brand,
    price,
    priceFrom,
    inStock: stock > 0,
    stockQuantity: stock,
    image: images[0] ? { url: images[0].url, alt: images[0].alt || p.name } : null,
    category: p.category
      ? { id: p.category.id, name: p.category.name, slug: p.category.slug }
      : null,
    createdAt: p.createdAt,
  };
}

export function toShopDetail(p: ProductWithShopRelations) {
  const media = (p.media || []).sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
  const specs = Array.isArray(p.specs) ? p.specs : [];

  return {
    ...toShopCard(p),
    description: p.description,
    unit: p.unit,
    specs: specs as Array<{ key: string; value: string }>,
    images: media
      .filter((m) => m.kind === 'image')
      .map((m): ShopImage => ({ url: m.url, alt: m.alt || p.name })),
    documents: media
      .filter((m) => m.kind === 'document')
      .map(
        (m): ShopDocument => ({
          url: m.url,
          filename: m.filename,
          size: m.size,
        })
      ),
    variants: (p.variants || []).map(
      (v): ShopVariant => ({
        id: v.id,
        name: v.name,
        price: v.price,
        inStock: (v.stockQuantity || 0) > 0,
        stockQuantity: v.stockQuantity || 0,
      })
    ),
  };
}

/** Shared relation config for shop product queries. */
export const shopProductWith = {
  category: true,
  media: true,
  variants: true,
} as const;
