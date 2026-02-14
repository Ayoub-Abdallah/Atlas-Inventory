<script setup lang="ts">
definePageMeta({ layout: 'default' });
const { t } = useI18n();
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">{{ t('reparations.create') }}</h1>
    <ReparationsReparationForm />
  </div>
</template>
