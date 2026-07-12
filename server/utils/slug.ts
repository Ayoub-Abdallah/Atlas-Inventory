import { eq, and, ne, like } from 'drizzle-orm';
import { products } from '../database/schema';

/**
 * Convert a product name to a URL-safe slug.
 * Handles accented latin (French) and transliterates Arabic to keep
 * slugs shareable on social platforms.
 */
export function slugify(input: string): string {
  const arabicMap: Record<string, string> = {
    ا: 'a', أ: 'a', إ: 'i', آ: 'a', ب: 'b', ت: 't', ث: 'th', ج: 'j',
    ح: 'h', خ: 'kh', د: 'd', ذ: 'dh', ر: 'r', ز: 'z', س: 's', ش: 'sh',
    ص: 's', ض: 'd', ط: 't', ظ: 'z', ع: 'a', غ: 'gh', ف: 'f', ق: 'q',
    ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', و: 'w', ي: 'y', ى: 'a',
    ة: 'a', ء: '', ئ: 'e', ؤ: 'o',
  };

  return input
    .split('')
    .map((ch) => arabicMap[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'product';
}

/**
 * Generate a slug unique across the products table.
 * Appends -2, -3, ... when the base slug is taken.
 */
export async function uniqueProductSlug(
  name: string,
  excludeProductId?: string
): Promise<string> {
  const db = useDB();
  const base = slugify(name);

  const taken = await db
    .select({ slug: products.slug })
    .from(products)
    .where(
      excludeProductId
        ? and(like(products.slug, `${base}%`), ne(products.id, excludeProductId))
        : like(products.slug, `${base}%`)
    );

  const takenSet = new Set(taken.map((r) => r.slug));
  if (!takenSet.has(base)) return base;

  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!takenSet.has(candidate)) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}
