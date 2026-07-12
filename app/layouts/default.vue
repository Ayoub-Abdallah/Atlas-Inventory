<script setup lang="ts">
// Storefront layout: public header + footer around shop and landing pages
</script>

<template>
  <div class="flex min-h-screen flex-col bg-white">
    <StoreHeader />
    <main class="flex-1">
      <slot />
    </main>
    <StoreFooter />
  </div>
</template>
