/**
 * Storefront config + price formatting. Fetched once and shared app-wide.
 */
export function useShopConfig() {
  const { data: config, ...rest } = useFetch('/api/shop/config', {
    key: 'shop-config',
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  });
  return { config, ...rest };
}

export function useShopPrice() {
  const { config } = useShopConfig();
  const { locale } = useI18n();

  const formatPrice = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    const currency = config.value?.currency || 'DZD';
    const localeTag =
      locale.value === 'ar' ? 'ar-DZ' : locale.value === 'en' ? 'en-US' : 'fr-FR';

    // DZD is commonly written "12 500 DA" locally; Intl renders it poorly
    if (currency === 'DZD') {
      const num = new Intl.NumberFormat(localeTag, {
        maximumFractionDigits: value % 1 === 0 ? 0 : 2,
      }).format(value);
      return locale.value === 'ar' ? `${num} دج` : `${num} DA`;
    }

    return new Intl.NumberFormat(localeTag, {
      style: 'currency',
      currency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  };

  return { config, formatPrice };
}

/** Rotating pastel tile backgrounds behind product photos. */
const TILE_CLASSES = [
  'bg-tile-blue',
  'bg-tile-peach',
  'bg-tile-mint',
  'bg-tile-lilac',
  'bg-tile-sand',
  'bg-tile-mist',
];

export function tileClassFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return TILE_CLASSES[Math.abs(hash) % TILE_CLASSES.length]!;
}
