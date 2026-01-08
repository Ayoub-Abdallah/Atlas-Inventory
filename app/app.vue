<script setup lang="ts">
const { settings } = useSettings();
const { locale, setLocale } = useI18n();

useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} - ${settings.value?.businessName || 'OpenStock'}` : settings.value?.businessName || 'OpenStock';
  }
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
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <!-- Toast notification system -->
    <UiToastContainer />
  </div>
</template>
