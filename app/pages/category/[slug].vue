<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
const slug = computed(() => route.params.slug as string);

// Resolve the category for the header (and 404 unknown slugs)
const { data } = await useFetch('/api/shop/products', {
  key: () => `category-head-${slug.value}`,
  query: computed(() => ({ category: slug.value, perPage: 1 })),
});

if (!data.value?.category) {
  throw createError({ statusCode: 404, message: 'Category not found', fatal: true });
}

const category = computed(() => data.value?.category);

useSeoMeta({
  title: () => category.value?.name || t('store.shop.title'),
  description: () =>
    category.value?.description ||
    t('store.category.metaDescription', { name: category.value?.name || '' }),
});
</script>

<template>
  <div>
    <div class="border-b border-gray-100 bg-gray-50/60">
      <div class="mx-auto max-w-7xl px-4 py-8 font-store sm:px-6">
        <nav class="mb-2 flex items-center gap-1.5 text-xs text-gray-400" :aria-label="t('store.breadcrumb')">
          <NuxtLink to="/shop" class="hover:text-cobalt-600">{{ t('store.nav.shop') }}</NuxtLink>
          <Icon name="lucide:chevron-right" class="h-3 w-3 rtl:rotate-180" />
          <span class="text-gray-600">{{ category?.name }}</span>
        </nav>
        <h1 class="font-display text-3xl font-bold tracking-tight text-ink">
          {{ category?.name }}
        </h1>
        <p v-if="category?.description" class="mt-1 text-sm text-gray-500">
          {{ category.description }}
        </p>
      </div>
    </div>
    <StoreCatalog :fixed-category="slug" />
  </div>
</template>
