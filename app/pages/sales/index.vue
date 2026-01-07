<script setup lang="ts">
definePageMeta({
  layout: 'default',
});

const { t } = useI18n();

// Fetch sales
const { data: sales, pending, refresh } = await useFetch('/api/sales');

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

// Format date
const formatDate = (date: Date | string) => {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

// Table columns
const columns = [
  { key: 'id', label: 'ID' },
  { key: 'createdAt', label: t('sales.sale_date') },
  { key: 'supplier', label: t('suppliers.title') },
  { key: 'items', label: t('sales.sale_items') },
  { key: 'total', label: t('sales.total') },
  { key: 'status', label: t('app.status') },
  { key: 'actions', label: t('app.actions') },
];

// Get status color
const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'bg-green-100 text-green-800';
    case 'draft':
      return 'bg-yellow-100 text-yellow-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">{{ t('sales.title') }}</h1>
        <p class="mt-1 text-sm text-gray-500">{{ t('sales.description') }}</p>
      </div>
      <div class="flex items-center gap-3">
        <NuxtLink to="/sales/draft">
          <UiButton variant="outline">
            <Icon name="lucide:file-edit" class="h-4 w-4 mr-2" />
            {{ t('sales.drafts') }}
          </UiButton>
        </NuxtLink>
        <NuxtLink to="/stock/scan">
          <UiButton variant="primary">
            <Icon name="lucide:plus" class="h-4 w-4 mr-2" />
            {{ t('sales.create_sale') }}
          </UiButton>
        </NuxtLink>
      </div>
    </div>

    <!-- Sales Table -->
    <UiDataTable
      :columns="columns"
      :data="sales || []"
      :loading="pending"
      :empty-title="t('sales.no_sales')"
      :empty-description="t('sales.no_sales_description')"
      empty-icon="lucide:receipt"
      hoverable
    >
      <template #id="{ item }">
        <span class="font-mono text-xs text-gray-500">
          {{ item.id.slice(0, 12) }}...
        </span>
      </template>
      
      <template #createdAt="{ item }">
        {{ formatDate(item.createdAt) }}
      </template>
      
      <template #supplier="{ item }">
        {{ item.supplier?.name || '-' }}
      </template>
      
      <template #items="{ item }">
        <span class="text-gray-600">
          {{ item.items?.length || 0 }} {{ t('sales.sale_items') }}
        </span>
      </template>
      
      <template #total="{ item }">
        <span class="font-medium text-gray-900">
          {{ formatCurrency(item.totalAmount || 0) }}
        </span>
      </template>
      
      <template #status="{ item }">
        <span
          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
          :class="getStatusColor(item.status)"
        >
          {{ t(`sales.${item.status}`) }}
        </span>
      </template>
      
      <template #actions="{ item }">
        <div class="flex items-center gap-2">
          <NuxtLink :to="`/sales/${item.id}`">
            <UiButton variant="ghost" size="sm">
              <Icon name="lucide:eye" class="h-4 w-4" />
            </UiButton>
          </NuxtLink>
        </div>
      </template>
    </UiDataTable>
  </div>
</template>
