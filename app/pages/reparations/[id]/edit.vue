<script setup lang="ts">
definePageMeta({ layout: 'default' });
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();

const repId = route.params.id as string;

// Fetch existing reparation
const { data: reparation, pending } = await useFetch(`/api/reparations/${repId}`);

// Redirect if not found
if (!reparation.value) {
  navigateTo('/reparations');
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-4">
      <UiButton variant="ghost" size="sm" @click="navigateTo(`/reparations/${repId}`)">
        <Icon name="lucide:arrow-left" class="h-4 w-4" />
      </UiButton>
      <h1 class="text-2xl font-bold">{{ t('reparations.edit') }}</h1>
    </div>
    
    <div v-if="pending" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-8 w-8 text-primary-600 animate-spin" />
    </div>
    
    <ReparationsReparationForm v-else-if="reparation" :reparation="reparation" :is-edit="true" />
  </div>
</template>
