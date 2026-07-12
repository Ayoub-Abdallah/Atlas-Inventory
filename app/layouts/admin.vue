<script setup lang="ts">
const { loggedIn } = useUserSession();
const { locale } = useI18n();

// Use useHead to set HTML attributes - this works on both server and client
useHead({
  htmlAttrs: {
    dir: () => locale.value === 'ar' ? 'rtl' : 'ltr',
    lang: () => locale.value,
  },
});
</script>

<template>
  <!-- Main layout when authenticated -->
  <div v-if="loggedIn" class="layout-container flex h-screen overflow-hidden bg-gray-100">
    <!-- Sidebar -->
    <AppSidebar class="print:hidden" />

    <!-- Main content -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- Header -->
      <AppHeader class="print:hidden" />

      <!-- Page content -->
      <main class="flex-1 overflow-auto print:overflow-visible">
        <div class="mx-auto max-w-7xl px-4 py-5 print:max-w-none print:px-0 print:py-0">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
