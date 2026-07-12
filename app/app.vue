<script setup lang="ts">
const { settings } = useSettings();
const { locale, setLocale } = useI18n();
const route = useRoute();

// Admin pages use the sidebar shell; everything else gets the storefront
// layout. Pages can still opt out with definePageMeta({ layout: false }).
const layoutName = computed(() => {
  if (route.meta.layout === false) return false;
  if (route.meta.layout) return route.meta.layout as string;
  return route.path === '/admin' || route.path.startsWith('/admin/')
    ? 'admin'
    : 'default';
});

useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} - ${settings.value?.businessName || 'OpenStock'}` : settings.value?.businessName || 'OpenStock';
  },
  htmlAttrs: {
    dir: () => (locale.value === 'ar' ? 'rtl' : 'ltr'),
    lang: () => locale.value,
  },
});

// Watch for language changes from settings (e.g., when user changes settings)
// Direction is handled reactively by useHead in direction plugin
watch(() => settings.value?.language, (newLang, oldLang) => {
  if (newLang && oldLang && newLang !== oldLang) {
    setLocale(newLang);
  }
});
</script>

<template>
  <div class="min-h-screen bg-background">
    <NuxtRouteAnnouncer />
    <NuxtLayout :name="layoutName">
      <NuxtPage />
    </NuxtLayout>
    <!-- Toast notification system -->
    <UiToastContainer />
  </div>
</template>
