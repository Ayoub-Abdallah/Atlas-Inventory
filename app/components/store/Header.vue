<script setup lang="ts">
import { useCartStore } from '~/stores/cart';
const { t, locale, setLocale } = useI18n();
const router = useRouter();
const route = useRoute();
const cart = useCartStore();
const { config } = useShopConfig();

const { data: categories } = useFetch('/api/shop/categories', {
  key: 'shop-categories',
  getCachedData: (key, nuxtApp) =>
    nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
});

const topCategories = computed(() =>
  (categories.value || []).filter((c) => !c.parentId).slice(0, 4)
);

const searchQuery = ref((route.query.q as string) || '');
const mobileOpen = ref(false);
const langOpen = ref(false);

function submitSearch() {
  const q = searchQuery.value.trim();
  mobileOpen.value = false;
  router.push({ path: '/shop', query: q ? { q } : {} });
}

const locales = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'ar', label: 'ع' },
] as const;

async function switchLocale(code: 'fr' | 'en' | 'ar') {
  await setLocale(code);
  langOpen.value = false;
}

onMounted(() => cart.load());

watch(() => route.fullPath, () => {
  mobileOpen.value = false;
  langOpen.value = false;
});
</script>

<template>
  <header
    class="sticky top-0 z-40 border-b border-gray-100 bg-white/90 font-store backdrop-blur supports-[backdrop-filter]:bg-white/75"
  >
    <div class="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
      <!-- Logo -->
      <NuxtLink to="/" class="flex shrink-0 items-center gap-2" :aria-label="config?.businessName || 'Atlas'">
        <img src="/branding/logo-small.webp" alt="" class="h-8 w-auto" >
      </NuxtLink>

      <!-- Desktop nav -->
      <nav class="hidden items-center gap-1 lg:flex" :aria-label="t('store.nav.main')">
        <NuxtLink
          to="/shop"
          class="rounded-full px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-ink"
          active-class="!text-cobalt-600"
        >
          {{ t('store.nav.shop') }}
        </NuxtLink>
        <NuxtLink
          v-for="cat in topCategories"
          :key="cat.id"
          :to="`/category/${cat.slug}`"
          class="rounded-full px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-ink"
          active-class="!text-cobalt-600"
        >
          {{ cat.name }}
        </NuxtLink>
      </nav>

      <div class="flex-1" />

      <!-- Search (desktop) -->
      <form class="relative hidden md:block" role="search" @submit.prevent="submitSearch">
        <Icon
          name="lucide:search"
          class="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 ltr:left-3 rtl:right-3"
        />
        <input
          v-model="searchQuery"
          type="search"
          :placeholder="t('store.nav.searchPlaceholder')"
          :aria-label="t('store.nav.searchPlaceholder')"
          class="h-9 w-48 rounded-full border border-gray-200 bg-gray-50 text-sm text-ink placeholder:text-gray-400 focus:border-cobalt-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cobalt-100 lg:w-64 ltr:pl-9 ltr:pr-3 rtl:pr-9 rtl:pl-3"
        >
      </form>

      <!-- Language switcher -->
      <div class="relative">
        <button
          type="button"
          class="flex h-9 items-center gap-1 rounded-full px-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          :aria-expanded="langOpen"
          :aria-label="t('store.nav.language')"
          @click="langOpen = !langOpen"
        >
          <Icon name="lucide:globe" class="h-4 w-4" />
          <span class="uppercase">{{ locale }}</span>
        </button>
        <Transition name="fade">
          <div
            v-if="langOpen"
            class="absolute top-11 z-50 w-28 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg ltr:right-0 rtl:left-0"
          >
            <button
              v-for="l in locales"
              :key="l.code"
              type="button"
              class="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-50"
              :class="locale === l.code ? 'font-semibold text-cobalt-600' : 'text-gray-700'"
              @click="switchLocale(l.code)"
            >
              {{ l.label }}
              <Icon v-if="locale === l.code" name="lucide:check" class="h-3.5 w-3.5" />
            </button>
          </div>
        </Transition>
      </div>

      <!-- Cart -->
      <NuxtLink
        to="/cart"
        class="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-50"
        :aria-label="t('store.nav.cart')"
      >
        <Icon name="lucide:shopping-bag" class="h-5 w-5" />
        <span
          v-if="cart.count > 0"
          class="absolute -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-cobalt-600 px-1 text-[10px] font-bold text-white ltr:-right-0.5 rtl:-left-0.5"
        >
          {{ cart.count > 99 ? '99+' : cart.count }}
        </span>
      </NuxtLink>

      <!-- Mobile menu button -->
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-50 lg:hidden"
        :aria-expanded="mobileOpen"
        :aria-label="t('store.nav.menu')"
        @click="mobileOpen = !mobileOpen"
      >
        <Icon :name="mobileOpen ? 'lucide:x' : 'lucide:menu'" class="h-5 w-5" />
      </button>
    </div>

    <!-- Mobile panel -->
    <Transition name="slide-down">
      <div v-if="mobileOpen" class="border-t border-gray-100 bg-white px-4 py-4 lg:hidden">
        <form class="relative mb-3" role="search" @submit.prevent="submitSearch">
          <Icon
            name="lucide:search"
            class="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 ltr:left-3 rtl:right-3"
          />
          <input
            v-model="searchQuery"
            type="search"
            :placeholder="t('store.nav.searchPlaceholder')"
            class="h-10 w-full rounded-full border border-gray-200 bg-gray-50 text-sm focus:border-cobalt-400 focus:bg-white focus:outline-none ltr:pl-9 ltr:pr-3 rtl:pr-9 rtl:pl-3"
          >
        </form>
        <nav class="flex flex-col" :aria-label="t('store.nav.main')">
          <NuxtLink to="/shop" class="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50">
            {{ t('store.nav.shop') }}
          </NuxtLink>
          <NuxtLink
            v-for="cat in topCategories"
            :key="cat.id"
            :to="`/category/${cat.slug}`"
            class="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            {{ cat.name }}
          </NuxtLink>
        </nav>
      </div>
    </Transition>
  </header>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.slide-down-enter-active,
.slide-down-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
@media (prefers-reduced-motion: reduce) {
  .fade-enter-active,
  .fade-leave-active,
  .slide-down-enter-active,
  .slide-down-leave-active {
    transition: none;
  }
}
</style>
