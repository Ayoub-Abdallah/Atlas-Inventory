<script setup lang="ts">
import { useCartStore } from '~/stores/cart';
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const cart = useCartStore();
const { formatPrice, config } = useShopPrice();

const slug = route.params.slug as string;

const { data, error } = await useFetch(`/api/shop/products/${slug}`, {
  key: `product-${slug}`,
});

if (error.value || !data.value) {
  throw createError({ statusCode: 404, message: 'Product not found', fatal: true });
}

const product = computed(() => data.value!.product);
const related = computed(() => data.value!.related);

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------
const activeImage = ref(0);
const zooming = ref(false);
const zoomOrigin = ref('50% 50%');
const galleryEl = ref<HTMLElement>();

function onZoomMove(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  zoomOrigin.value = `${x}% ${y}%`;
}

// Lazy-load non-active gallery images only when the gallery scrolls into view
const galleryVisible = ref(false);
onMounted(() => {
  if (!galleryEl.value || !('IntersectionObserver' in window)) {
    galleryVisible.value = true;
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        galleryVisible.value = true;
        observer.disconnect();
      }
    },
    { rootMargin: '200px' }
  );
  observer.observe(galleryEl.value);
  onBeforeUnmount(() => observer.disconnect());
});

// ---------------------------------------------------------------------------
// Variant + quantity + cart
// ---------------------------------------------------------------------------
const selectedVariantId = ref<string | null>(null);
const selectedVariant = computed(
  () => product.value.variants.find((v) => v.id === selectedVariantId.value) || null
);

// Preselect the first in-stock variant
watchEffect(() => {
  if (product.value.variants.length > 0 && !selectedVariantId.value) {
    const first =
      product.value.variants.find((v) => v.inStock) || product.value.variants[0];
    selectedVariantId.value = first?.id || null;
  }
});

const displayPrice = computed(() =>
  selectedVariant.value ? selectedVariant.value.price : product.value.price
);
const availableStock = computed(() =>
  selectedVariant.value ? selectedVariant.value.stockQuantity : product.value.stockQuantity
);
const inStock = computed(() => availableStock.value > 0);

const quantity = ref(1);
watch(selectedVariantId, () => (quantity.value = 1));

function addToCart(): boolean {
  if (!inStock.value) return false;
  cart.add(
    {
      productId: product.value.id,
      variantId: selectedVariant.value?.id || null,
      slug: product.value.slug,
      name: product.value.name,
      variantName: selectedVariant.value?.name || null,
      price: displayPrice.value,
      image: product.value.images[0]?.url || null,
      maxQuantity: availableStock.value,
    },
    quantity.value
  );
  toast.success(t('store.cart.added', { name: product.value.name }));
  return true;
}

function buyNow() {
  if (addToCart()) router.push('/checkout');
}

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------
const copied = ref(false);
async function shareProduct() {
  const url = import.meta.client ? window.location.href : '';
  if (import.meta.client && navigator.share) {
    try {
      await navigator.share({ title: product.value.name, url });
      return;
    } catch {
      // fall through to clipboard when the user dismisses the sheet
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    copied.value = true;
    toast.success(t('store.product.linkCopied'));
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    toast.error(t('store.product.shareFailed'));
  }
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
type Tab = 'description' | 'specs' | 'documents';
const availableTabs = computed(() => {
  const tabs: Tab[] = [];
  if (product.value.description) tabs.push('description');
  if (product.value.specs.length) tabs.push('specs');
  if (product.value.documents.length) tabs.push('documents');
  return tabs;
});
const activeTab = ref<Tab>('description');
watchEffect(() => {
  if (!availableTabs.value.includes(activeTab.value) && availableTabs.value[0]) {
    activeTab.value = availableTabs.value[0];
  }
});

function fileSize(bytes: number | null): string {
  if (!bytes) return '';
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

// ---------------------------------------------------------------------------
// SEO: title, description, OpenGraph with product image + price
// ---------------------------------------------------------------------------
const pageUrl = computed(() => {
  const base = config.value?.siteUrl?.replace(/\/$/, '') || '';
  return `${base}/product/${product.value.slug}`;
});
const ogImage = computed(() => {
  const img = product.value.images[0]?.url;
  if (!img) return undefined;
  const base = config.value?.siteUrl?.replace(/\/$/, '') || '';
  return img.startsWith('http') ? img : `${base}${img}`;
});

useSeoMeta({
  title: () => product.value.name,
  description: () =>
    product.value.description?.slice(0, 160) ||
    t('store.product.metaDescription', { name: product.value.name }),
  ogTitle: () => product.value.name,
  ogDescription: () => product.value.description?.slice(0, 160) || undefined,
  ogType: 'website',
  ogUrl: () => pageUrl.value,
  ogImage: () => ogImage.value,
  twitterCard: 'summary_large_image',
});

useHead({
  link: [{ rel: 'canonical', href: pageUrl.value }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.value.name,
          image: ogImage.value ? [ogImage.value] : undefined,
          description: product.value.description || undefined,
          brand: product.value.brand
            ? { '@type': 'Brand', name: product.value.brand }
            : undefined,
          offers: {
            '@type': 'Offer',
            price: displayPrice.value,
            priceCurrency: config.value?.currency || 'DZD',
            availability: inStock.value
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            url: pageUrl.value,
          },
        })
      ),
    },
  ],
});

const tile = computed(() => tileClassFor(product.value.id));
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 font-store sm:px-6">
    <!-- Breadcrumb -->
    <nav class="mb-6 flex items-center gap-1.5 text-xs text-gray-400" :aria-label="t('store.breadcrumb')">
      <NuxtLink to="/shop" class="hover:text-cobalt-600">{{ t('store.nav.shop') }}</NuxtLink>
      <template v-if="product.category">
        <Icon name="lucide:chevron-right" class="h-3 w-3 rtl:rotate-180" />
        <NuxtLink :to="`/category/${product.category.slug}`" class="hover:text-cobalt-600">
          {{ product.category.name }}
        </NuxtLink>
      </template>
      <Icon name="lucide:chevron-right" class="h-3 w-3 rtl:rotate-180" />
      <span class="truncate text-gray-600">{{ product.name }}</span>
    </nav>

    <div class="grid gap-10 lg:grid-cols-2">
      <!-- Gallery -->
      <div ref="galleryEl">
        <div
          class="relative flex aspect-square cursor-zoom-in items-center justify-center overflow-hidden rounded-4xl p-8"
          :class="tile"
          @mouseenter="zooming = true"
          @mouseleave="zooming = false"
          @mousemove="onZoomMove"
        >
          <img
            v-if="product.images[activeImage]"
            :src="product.images[activeImage]!.url"
            :alt="product.images[activeImage]!.alt || product.name"
            class="h-full w-full object-contain transition-transform duration-200"
            :style="zooming ? { transform: 'scale(1.8)', transformOrigin: zoomOrigin } : {}"
            fetchpriority="high"
          >
          <div v-else class="flex flex-col items-center gap-3 text-gray-400">
            <Icon name="lucide:smartphone" class="h-16 w-16" />
            <span class="text-sm">{{ t('store.product.noImage') }}</span>
          </div>
        </div>

        <!-- Thumbnails -->
        <div v-if="product.images.length > 1" class="mt-3 flex gap-2 overflow-x-auto pb-1">
          <button
            v-for="(img, i) in product.images"
            :key="img.url"
            type="button"
            class="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-gray-50 p-1 transition-colors"
            :class="i === activeImage ? 'border-cobalt-500' : 'border-transparent hover:border-gray-200'"
            :aria-label="`${t('store.product.viewImage')} ${i + 1}`"
            :aria-pressed="i === activeImage"
            @click="activeImage = i"
          >
            <img
              v-if="galleryVisible || i === 0"
              :src="img.url"
              :alt="img.alt || ''"
              loading="lazy"
              decoding="async"
              class="h-full w-full object-contain"
            >
          </button>
        </div>
      </div>

      <!-- Details -->
      <div>
        <p v-if="product.brand" class="text-sm font-medium uppercase tracking-wide text-gray-400">
          {{ product.brand }}
        </p>
        <div class="mt-1 flex items-start justify-between gap-3">
          <h1 class="font-display text-3xl font-bold leading-tight tracking-tight text-ink">
            {{ product.name }}
          </h1>
          <button
            type="button"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:border-cobalt-300 hover:text-cobalt-600"
            :title="t('store.product.share')"
            :aria-label="t('store.product.share')"
            @click="shareProduct"
          >
            <Icon :name="copied ? 'lucide:check' : 'lucide:share-2'" class="h-4.5 w-4.5" />
          </button>
        </div>

        <div class="mt-4 flex items-baseline gap-3">
          <p class="font-display text-3xl font-bold text-ink">
            {{ formatPrice(displayPrice) }}
          </p>
          <span
            class="rounded-full px-2.5 py-1 text-xs font-semibold"
            :class="inStock ? 'bg-success-muted text-success' : 'bg-gray-100 text-gray-500'"
          >
            {{
              inStock
                ? availableStock <= 3
                  ? t('store.product.lowStock', { count: availableStock })
                  : t('store.product.inStock')
                : t('store.product.outOfStock')
            }}
          </span>
        </div>

        <!-- Variant selector -->
        <fieldset v-if="product.variants.length" class="mt-6">
          <legend class="mb-2 text-sm font-semibold text-ink">
            {{ t('store.product.variant') }}
          </legend>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="variant in product.variants"
              :key="variant.id"
              type="button"
              class="rounded-full border px-4 py-2 text-sm font-medium transition-all"
              :class="[
                selectedVariantId === variant.id
                  ? 'border-ink bg-ink text-white'
                  : 'border-gray-200 text-gray-700 hover:border-gray-400',
                !variant.inStock ? 'opacity-40 line-through' : '',
              ]"
              :aria-pressed="selectedVariantId === variant.id"
              :disabled="!variant.inStock"
              @click="selectedVariantId = variant.id"
            >
              {{ variant.name }}
              <span v-if="variant.price !== product.price" class="text-xs opacity-70">
                · {{ formatPrice(variant.price) }}
              </span>
            </button>
          </div>
        </fieldset>

        <!-- Quantity + CTAs -->
        <div class="mt-8 flex flex-wrap items-center gap-3">
          <StoreQuantityStepper v-model="quantity" :max="Math.min(availableStock, 99)" />
          <button
            type="button"
            class="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white transition-all hover:bg-cobalt-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:min-w-44"
            :disabled="!inStock"
            @click="addToCart"
          >
            <Icon name="lucide:shopping-bag" class="h-4.5 w-4.5" />
            {{ t('store.product.addToCart') }}
          </button>
          <button
            type="button"
            class="flex h-11 items-center justify-center rounded-full border-2 border-ink px-6 text-sm font-semibold text-ink transition-all hover:border-cobalt-600 hover:text-cobalt-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!inStock"
            @click="buyNow"
          >
            {{ t('store.product.buyNow') }}
          </button>
        </div>

        <!-- Tabs -->
        <div v-if="availableTabs.length" class="mt-10">
          <div class="flex gap-1 border-b border-gray-100" role="tablist">
            <button
              v-for="tab in availableTabs"
              :key="tab"
              type="button"
              role="tab"
              :aria-selected="activeTab === tab"
              class="relative px-4 py-2.5 text-sm font-medium transition-colors"
              :class="activeTab === tab ? 'text-ink' : 'text-gray-400 hover:text-gray-600'"
              @click="activeTab = tab"
            >
              {{ t(`store.product.tabs.${tab}`) }}
              <span
                v-if="activeTab === tab"
                class="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-cobalt-600"
              />
            </button>
          </div>

          <div class="pt-5">
            <div
              v-if="activeTab === 'description'"
              class="max-w-prose whitespace-pre-line text-sm leading-relaxed text-gray-600"
            >
              {{ product.description }}
            </div>

            <dl v-else-if="activeTab === 'specs'" class="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <div
                v-for="spec in product.specs"
                :key="spec.key"
                class="flex items-baseline justify-between gap-4 border-b border-gray-50 pb-2"
              >
                <dt class="text-sm text-gray-500">{{ spec.key }}</dt>
                <dd class="text-sm font-medium text-ink ltr:text-right rtl:text-left">{{ spec.value }}</dd>
              </div>
            </dl>

            <ul v-else-if="activeTab === 'documents'" class="space-y-2">
              <li v-for="doc in product.documents" :key="doc.url">
                <a
                  :href="doc.url"
                  target="_blank"
                  rel="noopener"
                  download
                  class="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 transition-colors hover:border-cobalt-200 hover:bg-cobalt-50/40"
                >
                  <Icon name="lucide:file-down" class="h-5 w-5 shrink-0 text-cobalt-600" />
                  <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                    {{ doc.filename }}
                  </span>
                  <span class="shrink-0 text-xs text-gray-400">{{ fileSize(doc.size) }}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Recommended rail -->
    <section v-if="related.length" class="mt-16">
      <h2 class="mb-5 font-display text-xl font-bold tracking-tight text-ink">
        {{ t('store.product.recommended') }}
      </h2>
      <div class="scrollbar-none -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div
          v-for="item in related"
          :key="item.id"
          class="w-40 shrink-0 snap-start sm:w-52"
        >
          <StoreProductCard :product="item" />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.scrollbar-none {
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
@media (prefers-reduced-motion: reduce) {
  img {
    transition: none !important;
  }
}
</style>
