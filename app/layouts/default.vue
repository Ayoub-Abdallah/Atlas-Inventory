<script setup lang="ts">
const { loggedIn } = useUserSession();
const { locale } = useI18n();

// Computed RTL direction
const isRtl = computed(() => locale.value === 'ar');

// Update document direction when locale changes
watch(locale, (newLocale) => {
  if (import.meta.client) {
    document.documentElement.dir = newLocale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLocale;
  }
}, { immediate: true });

// Set initial direction on mount
onMounted(() => {
  document.documentElement.dir = locale.value === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = locale.value;
});
</script>

<template>
  <!-- Main layout when authenticated -->
  <div v-if="loggedIn" class="flex h-screen overflow-hidden bg-gray-100" :class="{ 'flex-row-reverse': isRtl }">
    <!-- Sidebar -->
    <AppSidebar />

    <!-- Main content -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- Header -->
      <AppHeader />

      <!-- Page content -->
      <main class="flex-1 overflow-auto">
        <div class="mx-auto max-w-7xl px-4 py-5">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
