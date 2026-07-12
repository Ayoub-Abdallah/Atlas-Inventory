<script setup lang="ts">
const { t } = useI18n();
const { formatPrice, config } = useShopPrice();

const { data: home, pending } = await useFetch('/api/shop/home', {
  key: 'shop-home',
});

const bestSellers = computed(() => home.value?.bestSellers || []);
const newArrivals = computed(() => home.value?.newArrivals || []);
const categories = computed(() => home.value?.categories || []);

// Flagship visual: the first best seller that has a real photo
const heroProduct = computed(
  () =>
    bestSellers.value.find((p) => p.image) ||
    newArrivals.value.find((p) => p.image) ||
    bestSellers.value[0] ||
    null
);

useSeoMeta({
  title: () => config.value?.businessName || 'Atlas',
  description: () => t('store.shop.metaDescription'),
  ogTitle: () => config.value?.businessName || 'Atlas',
  ogDescription: () => t('store.shop.metaDescription'),
});

const repairItems = [
  { icon: 'lucide:monitor-smartphone', key: 'screen' },
  { icon: 'lucide:battery-charging', key: 'battery' },
  { icon: 'lucide:settings-2', key: 'software' },
  { icon: 'lucide:stethoscope', key: 'diagnostics' },
] as const;
</script>

<template>
  <div class="font-store">
    <!-- ================= HERO ================= -->
    <section class="relative overflow-hidden">
      <div class="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-2 lg:gap-6 lg:pt-16">
        <!-- Copy -->
        <div class="max-w-xl">
          <h1
            class="hero-headline font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl"
          >
            {{ t('store.home.heroTitle') }}
          </h1>
          <p class="hero-reveal mt-5 max-w-md text-base leading-relaxed text-gray-600" style="--d: 120ms">
            {{ t('store.home.heroSubtitle') }}
          </p>
          <div class="hero-reveal mt-8 flex flex-wrap items-center gap-3" style="--d: 240ms">
            <NuxtLink
              to="/shop"
              class="flex h-12 items-center gap-2 rounded-full bg-ink px-7 text-sm font-semibold text-white transition-all hover:bg-cobalt-600 active:scale-[0.98]"
            >
              {{ t('store.home.heroCtaShop') }}
              <Icon name="lucide:arrow-right" class="h-4 w-4 rtl:rotate-180" />
            </NuxtLink>
            <a
              href="#repairs"
              class="flex h-12 items-center rounded-full border-2 border-gray-200 px-7 text-sm font-semibold text-ink transition-colors hover:border-cobalt-300 hover:text-cobalt-700"
            >
              {{ t('store.home.heroCtaRepairs') }}
            </a>
          </div>
        </div>

        <!-- Stage -->
        <div class="relative">
          <NuxtLink
            v-if="heroProduct"
            :to="`/product/${heroProduct.slug}`"
            class="hero-stage relative mx-auto flex aspect-square w-full max-w-md items-center justify-center rounded-4xl p-10 lg:max-w-lg"
            :class="tileClassFor(heroProduct.id)"
          >
            <img
              v-if="heroProduct.image"
              :src="heroProduct.image.url"
              :alt="heroProduct.image.alt || heroProduct.name"
              class="h-full w-full object-contain drop-shadow-xl"
              fetchpriority="high"
            >
            <Icon v-else name="lucide:smartphone" class="h-24 w-24 text-gray-400" />

            <!-- Floating chips -->
            <span
              class="hero-chip absolute top-8 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-ink shadow-md ltr:left-6 rtl:right-6"
              style="--d: 550ms"
            >
              {{ heroProduct.name }}
            </span>
            <span
              class="hero-chip absolute bottom-20 rounded-full bg-ink px-4 py-2 font-display text-sm font-bold text-white shadow-md ltr:right-6 rtl:left-6"
              style="--d: 700ms"
            >
              {{ formatPrice(heroProduct.price) }}
            </span>
            <span
              v-if="heroProduct.inStock"
              class="hero-chip absolute bottom-8 flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-semibold text-success shadow-md ltr:left-10 rtl:right-10"
              style="--d: 850ms"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-success" />
              {{ t('store.home.stockChip') }}
            </span>
          </NuxtLink>

          <!-- Stage skeleton while home data loads -->
          <div
            v-else-if="pending"
            class="mx-auto aspect-square w-full max-w-md animate-pulse rounded-4xl bg-gray-100 lg:max-w-lg"
          />
        </div>
      </div>
    </section>

    <!-- ================= CATEGORIES ================= -->
    <section v-if="categories.length" class="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div class="mb-6 flex items-baseline justify-between">
        <h2 class="font-display text-2xl font-bold tracking-tight text-ink">
          {{ t('store.home.categories') }}
        </h2>
        <NuxtLink to="/shop" class="text-sm font-medium text-cobalt-600 hover:text-cobalt-700">
          {{ t('store.home.viewAll') }}
        </NuxtLink>
      </div>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <NuxtLink
          v-for="(cat, i) in categories"
          :key="cat.id"
          :to="`/category/${cat.slug}`"
          class="group rounded-3xl p-5 transition-shadow hover:shadow-md"
          :class="tileClassFor(cat.id)"
        >
          <p class="font-display text-sm font-semibold text-ink group-hover:text-cobalt-700">
            {{ cat.name }}
          </p>
          <p class="mt-1 text-xs text-gray-500">
            {{ t('store.home.categoryCount', { count: cat.count }) }}
          </p>
          <Icon
            name="lucide:arrow-right"
            class="mt-4 h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-cobalt-600 rtl:rotate-180 rtl:group-hover:-translate-x-1"
          />
        </NuxtLink>
      </div>
    </section>

    <!-- ================= BEST SELLERS ================= -->
    <section v-if="bestSellers.length" class="border-y border-gray-100 bg-gray-50/50">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div class="mb-6 flex items-baseline justify-between">
          <h2 class="font-display text-2xl font-bold tracking-tight text-ink">
            {{ t('store.home.bestSellers') }}
          </h2>
          <NuxtLink to="/shop" class="text-sm font-medium text-cobalt-600 hover:text-cobalt-700">
            {{ t('store.home.viewAll') }}
          </NuxtLink>
        </div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          <StoreProductCard
            v-for="item in bestSellers.slice(0, 8)"
            :key="item.id"
            :product="item"
          />
        </div>
      </div>
    </section>

    <!-- ================= REPAIRS ================= -->
    <section id="repairs" class="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6">
      <div class="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <h2 class="font-display text-3xl font-bold tracking-tight text-ink">
            {{ t('store.home.repairs.title') }}
          </h2>
          <p class="mt-3 max-w-md text-base leading-relaxed text-gray-600">
            {{ t('store.home.repairs.subtitle') }}
          </p>
          <StoreRepairContact class="mt-7" />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div
            v-for="item in repairItems"
            :key="item.key"
            class="rounded-3xl border border-gray-100 bg-white p-5 transition-shadow hover:shadow-md"
          >
            <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-cobalt-50">
              <Icon :name="item.icon" class="h-5 w-5 text-cobalt-600" />
            </div>
            <p class="mt-3 font-display text-sm font-semibold text-ink">
              {{ t(`store.home.repairs.${item.key}`) }}
            </p>
            <p class="mt-1 text-xs leading-relaxed text-gray-500">
              {{ t(`store.home.repairs.${item.key}Desc`) }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= NEW ARRIVALS ================= -->
    <section v-if="newArrivals.length" class="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <div class="mb-6 flex items-baseline justify-between">
        <h2 class="font-display text-2xl font-bold tracking-tight text-ink">
          {{ t('store.home.newArrivals') }}
        </h2>
        <NuxtLink
          to="/shop?sort=new"
          class="text-sm font-medium text-cobalt-600 hover:text-cobalt-700"
        >
          {{ t('store.home.viewAll') }}
        </NuxtLink>
      </div>
      <div class="scrollbar-none -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div
          v-for="item in newArrivals"
          :key="item.id"
          class="w-40 shrink-0 snap-start sm:w-52"
        >
          <StoreProductCard :product="item" />
        </div>
      </div>
    </section>

    <!-- ================= CTA BAND ================= -->
    <section class="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <div class="flex flex-col items-center gap-5 rounded-4xl bg-ink px-6 py-14 text-center">
        <h2 class="max-w-xl font-display text-3xl font-bold tracking-tight text-white">
          {{ t('store.home.ctaTitle') }}
        </h2>
        <NuxtLink
          to="/shop"
          class="flex h-12 items-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-ink transition-all hover:bg-cobalt-100 active:scale-[0.98]"
        >
          {{ t('store.home.ctaButton') }}
          <Icon name="lucide:arrow-right" class="h-4 w-4 rtl:rotate-180" />
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Orchestrated hero load: copy rises in sequence, stage scales in,
   chips pop after the stage settles. */
@media (prefers-reduced-motion: no-preference) {
  /* Headline animates transform only: it stays painted from the first
     frame (fast LCP) while still taking part in the choreography */
  .hero-headline {
    animation: hero-headline-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .hero-reveal {
    animation: hero-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: var(--d, 0ms);
  }
  .hero-stage {
    animation: hero-stage-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) 150ms both;
  }
  .hero-chip {
    animation: hero-chip-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    animation-delay: var(--d, 500ms);
  }
}

@keyframes hero-headline-rise {
  from {
    transform: translateY(20px);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes hero-rise {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes hero-stage-in {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes hero-chip-pop {
  from {
    opacity: 0;
    transform: scale(0.7);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.scrollbar-none {
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
</style>
