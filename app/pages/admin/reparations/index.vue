<script setup lang="ts">
definePageMeta({
  layout: 'admin',
});

const { t } = useI18n();
const toast = useToast();

// Date range selector
const dateRange = ref('30d');
const customFrom = ref('');
const customTo = ref('');
const searchQuery = ref('');
const statusFilter = ref('all');

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

  // Use local date components to avoid UTC shift
  const pad = (n: number) => n.toString().padStart(2, '0');
  const toLocalDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  
  return {
    startDate: toLocalDateStr(from),
    endDate: toLocalDateStr(to),
  };
});

// Fetch reparations with filters
const { data: reparations, pending, refresh } = await useFetch(() => {
  const params = new URLSearchParams();
  params.append('startDate', dateParams.value.startDate);
  params.append('endDate', dateParams.value.endDate);
  if (searchQuery.value.trim()) {
    params.append('search', searchQuery.value.trim());
  }
  if (statusFilter.value && statusFilter.value !== 'all') {
    params.append('status', statusFilter.value);
  }
  return `/api/reparations?${params.toString()}`;
});

// Watch for filter changes
watch([searchQuery, statusFilter, dateRange, customFrom, customTo], () => {
  refresh();
});

// Fetch settings for currency
const { data: settings } = await useFetch('/api/settings');
const currency = computed(() => settings.value?.currency || 'DZD');

// Delete a reparation
async function deleteReparation(id: string) {
  if (!confirm(t('reparations.messages.confirm_delete'))) return;
  
  try {
    await $fetch(`/api/reparations/${id}`, { method: 'DELETE' });
    toast.add({
      title: t('app.success'),
      description: t('reparations.messages.deleted'),
      type: 'success',
    });
    await refresh();
  } catch (error: any) {
    toast.add({
      title: t('errors.server_error'),
      description: error.data?.message || error.message,
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

// Table columns
const columns = [
  { key: 'id', label: 'ID', width: 'w-1/12' },
  { key: 'customer', label: t('reparations.fields.customer'), width: 'w-1/6' },
  { key: 'issue', label: t('reparations.fields.reported_issue'), width: 'w-1/4' },
  { key: 'status', label: t('app.status'), width: 'w-1/12', align: 'center' },
  { key: 'costs', label: t('reparations.fields.total_cost'), width: 'w-1/12', align: 'right' },
  { key: 'price', label: t('reparations.fields.price'), width: 'w-1/12', align: 'right' },
  { key: 'date', label: t('reparations.fields.received_date'), width: 'w-1/6' },
  { key: 'actions', label: '', width: 'w-1/12', align: 'center' },
];

// Get status color
const getStatusColor = (status: string) => {
  switch (status) {
    case 'draft':
      return 'bg-gray-200 text-gray-700';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800';
    case 'diagnosed':
      return 'bg-purple-100 text-purple-800';
    case 'received':
      return 'bg-yellow-100 text-yellow-800';
    case 'returned':
      return 'bg-gray-100 text-gray-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

// Get payment status color
const getPaymentColor = (status: string) => {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-800';
    case 'partial':
      return 'bg-yellow-100 text-yellow-800';
    case 'unpaid':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

// Stats
const stats = computed(() => {
  const items = reparations.value || [];
  return {
    total: items.length,
    drafts: items.filter((r: any) => r.status === 'draft').length,
    active: items.filter((r: any) => ['received', 'diagnosed', 'in_progress'].includes(r.status)).length,
    completed: items.filter((r: any) => ['completed', 'returned'].includes(r.status)).length,
    revenue: items
      .filter((r: any) => r.status !== 'draft' && r.status !== 'cancelled')
      .reduce((sum: number, r: any) => sum + (r.paidAmount || 0), 0),
    totalValue: items
      .filter((r: any) => r.status !== 'draft' && r.status !== 'cancelled')
      .reduce((sum: number, r: any) => sum + (r.price || 0), 0),
    unpaid: items
      .filter((r: any) => r.status !== 'draft' && r.status !== 'cancelled')
      .reduce((sum: number, r: any) => sum + Math.max(0, (r.price || 0) - (r.paidAmount || 0)), 0),
  };
});
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
              :placeholder="t('reparations.filters.search_placeholder')"
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <!-- Status Filter -->
        <div class="w-[180px]">
          <select 
            v-model="statusFilter"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">{{ t('reparations.filters.all_statuses') }}</option>
            <option value="draft">{{ t('reparations.status.draft') }}</option>
            <option value="received">{{ t('reparations.status.received') }}</option>
            <option value="diagnosed">{{ t('reparations.status.diagnosed') }}</option>
            <option value="in_progress">{{ t('reparations.status.in_progress') }}</option>
            <option value="completed">{{ t('reparations.status.completed') }}</option>
            <option value="returned">{{ t('reparations.status.returned') }}</option>
            <option value="cancelled">{{ t('reparations.status.cancelled') }}</option>
          </select>
        </div>

        <!-- Date Range -->
        <div class="w-[150px]">
          <select 
            v-model="dateRange"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="today">{{ t('filters.today') }}</option>
            <option value="30d">{{ t('filters.30_days') }}</option>
            <option value="90d">{{ t('filters.90_days') }}</option>
            <option value="1y">{{ t('filters.1_year') }}</option>
            <option value="custom">{{ t('filters.custom') }}</option>
          </select>
        </div>

        <!-- Custom Date Inputs -->
        <template v-if="dateRange === 'custom'">
          <input 
            v-model="customFrom"
            type="date" 
            class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span class="text-sm text-gray-500">{{ t('app.to') }}</span>
          <input 
            v-model="customTo"
            type="date" 
            class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </template>
      </div>
    </div>

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">{{ t('reparations.title') }}</h1>
        <p class="mt-1 text-sm text-gray-500">{{ t('reparations.description') }}</p>
      </div>
      <div class="flex items-center gap-3">
        <UiButton variant="primary" @click="$router.push('/admin/reparations/new')">
          <Icon name="lucide:plus" class="h-4 w-4 mr-2" />
          {{ t('reparations.create') }}
        </UiButton>
      </div>
    </div>

    <!-- Stats -->
    <div class="flex gap-3 flex-wrap">
      <div class="flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-1.5">
        <Icon name="lucide:clipboard-list" class="h-3.5 w-3.5 text-gray-400" />
        <span class="text-xs text-gray-600">{{ t('reparations.summary.total_reparations') }}: <strong>{{ stats.total }}</strong></span>
      </div>
      <div v-if="stats.drafts > 0" class="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-1.5">
        <Icon name="lucide:file-edit" class="h-3.5 w-3.5 text-amber-500" />
        <span class="text-xs text-amber-700">{{ t('reparations.summary.drafts') }}: <strong>{{ stats.drafts }}</strong></span>
      </div>
      <div class="flex items-center gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-1.5">
        <Icon name="lucide:wrench" class="h-3.5 w-3.5 text-blue-500" />
        <span class="text-xs text-blue-700">{{ t('reparations.summary.active_repairs') }}: <strong>{{ stats.active }}</strong></span>
      </div>
      <div class="flex items-center gap-2 rounded border border-green-200 bg-green-50 px-3 py-1.5">
        <Icon name="lucide:check-circle" class="h-3.5 w-3.5 text-green-500" />
        <span class="text-xs text-green-700">{{ t('reparations.summary.completed') }}: <strong>{{ stats.completed }}</strong></span>
      </div>
      <div class="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5">
        <Icon name="lucide:banknote" class="h-3.5 w-3.5 text-emerald-500" />
        <span class="text-xs text-emerald-700">{{ t('reparations.summary.total_value') }}: <strong>{{ formatCurrency(stats.totalValue) }}</strong></span>
      </div>
      <div class="flex items-center gap-2 rounded border border-green-200 bg-green-50 px-3 py-1.5">
        <Icon name="lucide:circle-dollar-sign" class="h-3.5 w-3.5 text-green-500" />
        <span class="text-xs text-green-700">{{ t('reparations.summary.collected') }}: <strong>{{ formatCurrency(stats.revenue) }}</strong></span>
      </div>
      <div v-if="stats.unpaid > 0" class="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-1.5">
        <Icon name="lucide:alert-circle" class="h-3.5 w-3.5 text-red-500" />
        <span class="text-xs text-red-700">{{ t('reparations.summary.outstanding') }}: <strong>{{ formatCurrency(stats.unpaid) }}</strong></span>
      </div>
    </div>

    <!-- Data Table -->
    <UiDataTable
      :columns="columns"
      :data="reparations || []"
      :loading="pending"
      :empty-title="t('reparations.no_reparations')"
      :empty-description="t('reparations.no_reparations_description')"
      empty-icon="lucide:wrench"
      hoverable
    >
      <template #id="{ item }">
        <NuxtLink :to="`/admin/reparations/${item.id}`" class="text-indigo-600 hover:text-indigo-800 font-mono text-sm">
          {{ item.id }}
        </NuxtLink>
      </template>

      <template #customer="{ item }">
        <div class="text-sm">
          <div v-if="item.customer" class="font-medium text-gray-900">{{ item.customer.name }}</div>
          <div v-else class="text-gray-400 italic">{{ t('app.none') }}</div>
          <div v-if="item.customer?.phone" class="text-xs text-gray-500">{{ item.customer.phone }}</div>
        </div>
      </template>

      <template #issue="{ item }">
        <div class="text-sm text-gray-900">
          {{ item.reportedIssue || '-' }}
        </div>
      </template>

      <template #status="{ item }">
        <span :class="['inline-flex items-center px-2 py-1 rounded-full text-xs font-medium', getStatusColor(item.status)]">
          {{ t(`reparations.status.${item.status}`) }}
        </span>
      </template>

      <template #costs="{ item }">
        <div class="text-sm text-right">
          <div class="font-medium text-gray-900">{{ formatCurrency(item.totalCost || 0) }}</div>
          <div class="text-xs text-gray-500">
            <span :class="['inline-flex items-center px-1.5 py-0.5 rounded text-xs', getPaymentColor(item.paymentStatus)]">
              {{ t(`reparations.payment.${item.paymentStatus}`) }}
            </span>
          </div>
        </div>
      </template>

      <template #price="{ item }">
        <div class="text-sm font-medium text-gray-900 text-right">
          {{ formatCurrency(item.price || 0) }}
        </div>
      </template>

      <template #date="{ item }">
        <div class="text-sm text-gray-600">
          {{ formatDate(item.createdAt) }}
        </div>
      </template>

      <template #actions="{ item }">
        <div class="flex items-center justify-center gap-2">
          <NuxtLink :to="`/admin/reparations/${item.id}`">
            <button class="text-gray-400 hover:text-indigo-600" :title="t('reparations.view')">
              <Icon name="lucide:eye" class="h-4 w-4" />
            </button>
          </NuxtLink>
          <NuxtLink 
            v-if="['draft', 'received', 'diagnosed', 'in_progress'].includes(item.status)"
            :to="`/admin/reparations/${item.id}/edit`"
          >
            <button class="text-gray-400 hover:text-indigo-600" :title="t('app.edit')">
              <Icon name="lucide:pencil" class="h-4 w-4" />
            </button>
          </NuxtLink>
          <button 
            v-if="!['completed', 'returned'].includes(item.status)"
            @click="deleteReparation(item.id)" 
            class="text-gray-400 hover:text-red-600"
            :title="t('reparations.delete')"
          >
            <Icon name="lucide:trash-2" class="h-4 w-4" />
          </button>
        </div>
      </template>
    </UiDataTable>
  </div>
</template>

