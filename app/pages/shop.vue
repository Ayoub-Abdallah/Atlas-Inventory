<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();

useSeoMeta({
  title: () =>
    route.query.q ? `${route.query.q} · ${t('store.shop.title')}` : t('store.shop.title'),
  description: () => t('store.shop.metaDescription'),
});
</script>

<template>
  <div>
    <div class="border-b border-gray-100 bg-gray-50/60">
      <div class="mx-auto max-w-7xl px-4 py-8 font-store sm:px-6">
        <h1 class="font-display text-3xl font-bold tracking-tight text-ink">
          {{ t('store.shop.title') }}
        </h1>
        <p class="mt-1 text-sm text-gray-500">{{ t('store.shop.subtitle') }}</p>
      </div>
    </div>
    <StoreCatalog />
  </div>
</template>
