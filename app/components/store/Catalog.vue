<script setup lang="ts">
/**
 * Catalog with category/brand/price filters, search, sort and pagination.
 * Filter state lives in the URL query so results are shareable.
 */
const props = defineProps<{
  fixedCategory?: string; // category slug when used on /category/[slug]
}>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { formatPrice } = useShopPrice();

const { data: categories } = useFetch('/api/shop/categories', {
  key: 'shop-categories',
  getCachedData: (key, nuxtApp) =>
    nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
});

// Filters mirror the URL query
const q = computed(() => (route.query.q as string) || '');
const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const sort = computed(() => (route.query.sort as string) || 'new');
const brand = computed(() => (route.query.brand as string) || '');
const minPrice = computed(() => (route.query.minPrice as string) || '');
const maxPrice = computed(() => (route.query.maxPrice as string) || '');
const categorySlug = computed(
  () => props.fixedCategory || (route.query.category as string) || ''
);

const query = computed(() => ({
  ...(q.value ? { q: q.value } : {}),
  ...(categorySlug.value ? { category: categorySlug.value } : {}),
  ...(brand.value ? { brand: brand.value } : {}),
  ...(minPrice.value ? { minPrice: minPrice.value } : {}),
  ...(maxPrice.value ? { maxPrice: maxPrice.value } : {}),
  sort: sort.value,
  page: page.value,
  perPage: 12,
}));

const { data, pending } = useFetch('/api/shop/products', {
  key: 'shop-catalog',
  query,
  watch: [query],
});

const items = computed(() => data.value?.items || []);
const total = computed(() => data.value?.total || 0);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / 12)));
const facets = computed(() => data.value?.facets || { brands: [], price: null });

// Local inputs for the price filter (applied on submit)
const priceMinInput = ref(minPrice.value);
const priceMaxInput = ref(maxPrice.value);
watch([minPrice, maxPrice], () => {
  priceMinInput.value = minPrice.value;
  priceMaxInput.value = maxPrice.value;
});

const filtersOpen = ref(false);

function updateQuery(patch: Record<string, string | number | undefined>) {
  const next: Record<string, any> = { ...route.query, ...patch };
  for (const key of Object.keys(next)) {
    if (next[key] === '' || next[key] === undefined) delete next[key];
  }
  // Reset pagination whenever a filter changes
  if (!('page' in patch)) delete next.page;
  router.push({ query: next });
}

function applyPrice() {
  updateQuery({
    minPrice: priceMinInput.value || undefined,
    maxPrice: priceMaxInput.value || undefined,
  });
}

function clearFilters() {
  priceMinInput.value = '';
  priceMaxInput.value = '';
  router.push({
    query: {
      ...(q.value ? { q: q.value } : {}),
    },
  });
}

const hasActiveFilters = computed(
  () =>
    !!brand.value ||
    !!minPrice.value ||
    !!maxPrice.value ||
    (!props.fixedCategory && !!categorySlug.value)
);

const pagesToShow = computed(() => {
  const pages: number[] = [];
  const start = Math.max(1, page.value - 2);
  const end = Math.min(totalPages.value, start + 4);
  for (let p = start; p <= end; p++) pages.push(p);
  return pages;
});
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 font-store sm:px-6">
    <div class="flex flex-col gap-8 lg:flex-row">
      <!-- Sidebar filters -->
      <aside class="w-full shrink-0 lg:w-60">
        <button
          type="button"
          class="mb-3 flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-ink lg:hidden"
          :aria-expanded="filtersOpen"
          @click="filtersOpen = !filtersOpen"
        >
          {{ t('store.catalog.filters') }}
          <Icon :name="filtersOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="h-4 w-4" />
        </button>

        <div class="space-y-7" :class="filtersOpen ? 'block' : 'hidden lg:block'">
          <!-- Categories -->
          <div v-if="!fixedCategory">
            <h2 class="mb-3 font-display text-sm font-semibold text-ink">
              {{ t('store.catalog.categories') }}
            </h2>
            <ul class="space-y-1">
              <li>
                <button
                  type="button"
                  class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors"
                  :class="!categorySlug ? 'bg-cobalt-50 font-semibold text-cobalt-700' : 'text-gray-600 hover:bg-gray-50'"
                  @click="updateQuery({ category: undefined })"
                >
                  {{ t('store.catalog.allCategories') }}
                </button>
              </li>
              <li v-for="cat in categories || []" :key="cat.id">
                <button
                  type="button"
                  class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors"
                  :class="categorySlug === cat.slug ? 'bg-cobalt-50 font-semibold text-cobalt-700' : 'text-gray-600 hover:bg-gray-50'"
                  @click="updateQuery({ category: cat.slug || undefined })"
                >
                  <span :class="cat.parentId ? 'ltr:pl-3 rtl:pr-3' : ''">{{ cat.name }}</span>
                  <span class="text-xs text-gray-400">{{ cat.count }}</span>
                </button>
              </li>
            </ul>
          </div>

          <!-- Price -->
          <div>
            <h2 class="mb-3 font-display text-sm font-semibold text-ink">
              {{ t('store.catalog.price') }}
            </h2>
            <form class="flex items-center gap-2" @submit.prevent="applyPrice">
              <input
                v-model="priceMinInput"
                type="number"
                min="0"
                :placeholder="t('store.catalog.min')"
                :aria-label="t('store.catalog.minPrice')"
                class="h-9 w-full min-w-0 rounded-lg border border-gray-200 px-2.5 text-sm focus:border-cobalt-400 focus:outline-none focus:ring-2 focus:ring-cobalt-100"
              >
              <span class="text-gray-300">-</span>
              <input
                v-model="priceMaxInput"
                type="number"
                min="0"
                :placeholder="t('store.catalog.max')"
                :aria-label="t('store.catalog.maxPrice')"
                class="h-9 w-full min-w-0 rounded-lg border border-gray-200 px-2.5 text-sm focus:border-cobalt-400 focus:outline-none focus:ring-2 focus:ring-cobalt-100"
              >
              <button
                type="submit"
                class="flex h-9 w-10 shrink-0 items-center justify-center rounded-lg bg-ink text-white transition-colors hover:bg-cobalt-600"
                :aria-label="t('store.catalog.applyPrice')"
              >
                <Icon name="lucide:arrow-right" class="h-4 w-4 rtl:rotate-180" />
              </button>
            </form>
            <p v-if="facets.price" class="mt-2 text-xs text-gray-400">
              {{ formatPrice(facets.price.min) }} - {{ formatPrice(facets.price.max) }}
            </p>
          </div>

          <!-- Brands -->
          <div v-if="facets.brands.length">
            <h2 class="mb-3 font-display text-sm font-semibold text-ink">
              {{ t('store.catalog.brand') }}
            </h2>
            <ul class="space-y-1">
              <li v-for="b in facets.brands" :key="b.name">
                <button
                  type="button"
                  class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors"
                  :class="brand === b.name ? 'bg-cobalt-50 font-semibold text-cobalt-700' : 'text-gray-600 hover:bg-gray-50'"
                  @click="updateQuery({ brand: brand === b.name ? undefined : b.name })"
                >
                  {{ b.name }}
                  <span class="text-xs text-gray-400">{{ b.count }}</span>
                </button>
              </li>
            </ul>
          </div>

          <button
            v-if="hasActiveFilters"
            type="button"
            class="text-sm font-medium text-cobalt-600 hover:text-cobalt-700"
            @click="clearFilters"
          >
            {{ t('store.catalog.clearFilters') }}
          </button>
        </div>
      </aside>

      <!-- Results -->
      <div class="min-w-0 flex-1">
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-gray-500" aria-live="polite">
            <template v-if="q">
              {{ t('store.catalog.resultsFor', { count: total, query: q }) }}
            </template>
            <template v-else>
              {{ t('store.catalog.results', { count: total }) }}
            </template>
          </p>
          <label class="flex items-center gap-2 text-sm text-gray-600">
            {{ t('store.catalog.sortBy') }}
            <select
              :value="sort"
              class="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm text-ink focus:border-cobalt-400 focus:outline-none focus:ring-2 focus:ring-cobalt-100"
              @change="updateQuery({ sort: ($event.target as HTMLSelectElement).value })"
            >
              <option value="new">{{ t('store.catalog.sort.new') }}</option>
              <option value="price-asc">{{ t('store.catalog.sort.priceAsc') }}</option>
              <option value="price-desc">{{ t('store.catalog.sort.priceDesc') }}</option>
              <option value="name">{{ t('store.catalog.sort.name') }}</option>
            </select>
          </label>
        </div>

        <!-- Grid -->
        <div v-if="pending" class="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
          <StoreProductCardSkeleton v-for="i in 8" :key="i" />
        </div>

        <div
          v-else-if="items.length"
          class="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4"
        >
          <StoreProductCard v-for="item in items" :key="item.id" :product="item" />
        </div>

        <!-- Empty state -->
        <div v-else class="flex flex-col items-center gap-3 py-20 text-center">
          <Icon name="lucide:package-search" class="h-10 w-10 text-gray-300" />
          <p class="font-display text-lg font-semibold text-ink">
            {{ t('store.catalog.empty.title') }}
          </p>
          <p class="max-w-sm text-sm text-gray-500">{{ t('store.catalog.empty.description') }}</p>
          <button
            v-if="hasActiveFilters || q"
            type="button"
            class="mt-2 rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-cobalt-600"
            @click="clearFilters"
          >
            {{ t('store.catalog.clearFilters') }}
          </button>
        </div>

        <!-- Pagination -->
        <nav
          v-if="totalPages > 1"
          class="mt-10 flex items-center justify-center gap-1.5"
          :aria-label="t('store.catalog.pagination')"
        >
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-30"
            :disabled="page <= 1"
            :aria-label="t('store.catalog.prevPage')"
            @click="updateQuery({ page: page - 1 })"
          >
            <Icon name="lucide:chevron-left" class="h-4 w-4 rtl:rotate-180" />
          </button>
          <button
            v-for="p in pagesToShow"
            :key="p"
            type="button"
            class="h-9 w-9 rounded-full text-sm font-medium transition-colors"
            :class="p === page ? 'bg-ink text-white' : 'text-gray-600 hover:bg-gray-50'"
            :aria-current="p === page ? 'page' : undefined"
            @click="updateQuery({ page: p })"
          >
            {{ p }}
          </button>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-30"
            :disabled="page >= totalPages"
            :aria-label="t('store.catalog.nextPage')"
            @click="updateQuery({ page: page + 1 })"
          >
            <Icon name="lucide:chevron-right" class="h-4 w-4 rtl:rotate-180" />
          </button>
        </nav>
      </div>
    </div>
  </div>
</template>
