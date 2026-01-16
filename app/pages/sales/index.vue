<script setup lang="ts">
definePageMeta({
  layout: 'default',
});

const { t } = useI18n();
const toast = useToast();

// Helper function to add toast (compatible with old code)
const addToast = (options: { title: string; message?: string; type: 'success' | 'error' | 'warning' | 'info' }) => {
  toast.add({
    title: options.title,
    description: options.message,
    type: options.type,
  });
};


// Date range selector
const dateRange = ref('30d');
const customFrom = ref('');
const customTo = ref('');
const searchQuery = ref('');

const dateParams = computed(() => {
  const now = new Date();
  let from: Date;
  let to: Date;
  
  switch (dateRange.value) {
    case 'today':
      from = new Date();
      from.setHours(0, 0, 0, 0);
      to = new Date();
      to.setHours(23, 59, 59, 999);
      break;
    case '30d':
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      to = now;
      break;
    case '90d':
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      to = now;
      break;
    case '1y':
      from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      to = now;
      break;
    case 'custom':
      from = customFrom.value ? new Date(customFrom.value) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      to = customTo.value ? new Date(customTo.value) : now;
      break;
    default:
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      to = now;
  }
  
  return {
    startDate: from.toISOString().split('T')[0],
    endDate: to.toISOString().split('T')[0],
  };
});

// Fetch sales with date filter and search
const { data: sales, pending, refresh } = await useFetch(() => {
  const params = new URLSearchParams();
  params.append('startDate', dateParams.value.startDate);
  params.append('endDate', dateParams.value.endDate);
  if (searchQuery.value.trim()) {
    params.append('search', searchQuery.value.trim());
  }
  return `/api/sales?${params.toString()}`;
});

// Watch for search changes with debounce
watch(searchQuery, () => {
  refresh();
});

// Watch for date range changes
watch([dateRange, customFrom, customTo], () => {
  refresh();
});

// Fetch settings for currency
const { data: settings } = await useFetch('/api/settings');
const currency = computed(() => settings.value?.currency || 'DZD');

// Cleaning up drafts
const isCleaningDrafts = ref(false);

async function cleanupDrafts() {
  if (!confirm(t('sales.confirm_cleanup_drafts'))) return;
  
  isCleaningDrafts.value = true;
  try {
    const result = await $fetch('/api/sales/__cleanup-drafts', { method: 'POST' });
    addToast({
      title: t('app.success'),
      message: `${(result as any).deletedCount} ${t('sales.drafts_deleted')}`,
      type: 'success',
    });
    await refresh();
  } catch (error: any) {
    addToast({
      title: t('errors.server_error'),
      message: error.message,
      type: 'error',
    });
  } finally {
    isCleaningDrafts.value = false;
  }
}

// Delete a single sale
async function deleteSale(saleId: string) {
  if (!confirm(t('sales.confirm_delete'))) return;
  
  try {
    await $fetch(`/api/sales/${saleId}`, { method: 'DELETE' });
    addToast({
      title: t('app.success'),
      message: t('sales.sale_deleted'),
      type: 'success',
    });
    await refresh();
  } catch (error: any) {
    addToast({
      title: t('errors.server_error'),
      message: error.data?.message || error.message,
      type: 'error',
    });
  }
}

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.value,
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

// Check if there are draft sales
const hasDraftSales = computed(() => 
  (sales.value || []).some((s: any) => s.status === 'draft')
);

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
    <!-- Filters -->
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <div class="flex flex-wrap items-center gap-3">
        <!-- Search -->
        <div class="flex-1 min-w-[250px]">
          <div class="relative">
            <Icon name="lucide:search" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              v-model="searchQuery"
              type="text" 
              :placeholder="t('sales.search_placeholder')"
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <!-- Date Range Selector -->
        <select v-model="dateRange" class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="today">{{ t('finance.today') }}</option>
          <option value="30d">{{ t('finance.last_30_days') }}</option>
          <option value="90d">{{ t('finance.last_90_days') }}</option>
          <option value="1y">{{ t('finance.last_year') }}</option>
          <option value="custom">{{ t('finance.custom') }}</option>
        </select>
        
        <input 
          v-if="dateRange === 'custom'" 
          v-model="customFrom" 
          type="date" 
          class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" 
        />
        <span v-if="dateRange === 'custom'" class="text-gray-500 text-sm">{{ t('app.to') }}</span>
        <input 
          v-if="dateRange === 'custom'" 
          v-model="customTo" 
          type="date" 
          class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" 
        />
      </div>
    </div>
    
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">{{ t('sales.title') }}</h1>
        <p class="mt-1 text-sm text-gray-500">{{ t('sales.description') }}</p>
      </div>
      <div class="flex items-center gap-3">
        <UiButton 
          v-if="hasDraftSales"
          variant="outline" 
          :loading="isCleaningDrafts"
          @click="cleanupDrafts"
        >
          <Icon name="lucide:trash-2" class="h-4 w-4 mr-2" />
          {{ t('sales.cleanup_drafts') }}
        </UiButton>
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
          <UiButton 
            v-if="item.status === 'draft'" 
            variant="ghost" 
            size="sm"
            @click="deleteSale(item.id)"
          >
            <Icon name="lucide:trash-2" class="h-4 w-4 text-red-500" />
          </UiButton>
        </div>
      </template>
    </UiDataTable>
  </div>
</template>
