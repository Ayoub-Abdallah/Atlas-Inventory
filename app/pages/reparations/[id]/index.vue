<script setup lang="ts">
definePageMeta({
  layout: 'default',
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();

const repId = route.params.id as string;

// Fetch reparation details
const { data: reparation, pending, error, refresh } = await useFetch(`/api/reparations/${repId}`);

// Fetch settings for currency
const { data: settings } = await useFetch('/api/settings');
const currency = computed(() => settings.value?.currency || 'DZD');

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.value,
  }).format(value);
};

// Format date
const formatDate = (date: Date | string | null) => {
  if (!date) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

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

// Editable statuses (not final)
const isEditable = computed(() => {
  if (!reparation.value) return false;
  return ['draft', 'received', 'diagnosed', 'in_progress'].includes(reparation.value.status);
});

// Update status
const isUpdatingStatus = ref(false);
async function updateStatus(newStatus: string) {
  if (!confirm(t('reparations.messages.status_updated'))) return;
  
  isUpdatingStatus.value = true;
  try {
    await $fetch(`/api/reparations/${repId}/status`, {
      method: 'PATCH',
      body: { status: newStatus },
    });
    toast.add({
      title: t('app.success'),
      description: t('reparations.messages.status_updated'),
      type: 'success',
    });
    await refresh();
  } catch (error: any) {
    toast.add({
      title: t('errors.server_error'),
      description: error.data?.message || error.message,
      type: 'error',
    });
  } finally {
    isUpdatingStatus.value = false;
  }
}

// Print receipt
const printReceipt = () => {
  window.print();
};

// Parts table columns
const partsColumns = [
  { key: 'name', label: t('reparations.fields.part_name'), width: 'w-1/2' },
  { key: 'quantity', label: t('reparations.fields.quantity'), width: 'w-1/6', align: 'right' },
  { key: 'unitCost', label: t('reparations.fields.unit_cost'), width: 'w-1/6', align: 'right' },
  { key: 'lineTotal', label: t('reparations.fields.line_total'), width: 'w-1/6', align: 'right' },
];

// Payments table columns
const paymentsColumns = [
  { key: 'date', label: t('app.date'), width: 'w-1/3' },
  { key: 'amount', label: t('payments.amount'), width: 'w-1/3', align: 'right' },
  { key: 'method', label: t('payments.method'), width: 'w-1/3' },
];
</script>

<template>
  <div class="space-y-6">
    <!-- Loading -->
    <div v-if="pending" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-8 w-8 text-primary-600 animate-spin" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 rounded-xl p-8 text-center">
      <Icon name="lucide:alert-circle" class="h-12 w-12 text-red-400 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-red-800 mb-2">{{ t('errors.not_found') }}</h3>
      <p class="text-sm text-red-600 mb-4">Reparation not found</p>
      <UiButton variant="outline" @click="navigateTo('/reparations')">
        <Icon name="lucide:arrow-left" class="h-4 w-4 mr-2" />
        {{ t('app.back') }}
      </UiButton>
    </div>

    <!-- Reparation Details -->
    <div v-else-if="reparation" class="print:bg-white">
      <!-- Header -->
      <div class="flex items-center justify-between print:hidden">
        <div class="flex items-center gap-4">
          <UiButton variant="ghost" size="sm" @click="navigateTo('/reparations')">
            <Icon name="lucide:arrow-left" class="h-4 w-4" />
          </UiButton>
          <div>
            <h1 class="text-2xl font-bold text-gray-900">
              {{ t('reparations.view') }}
            </h1>
            <p class="text-sm text-gray-500 font-mono">{{ reparation.id }}</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <UiButton v-if="isEditable" variant="outline" @click="navigateTo(`/reparations/${repId}/edit`)">
            <Icon name="lucide:pencil" class="h-4 w-4 mr-2" />
            {{ t('app.edit') }}
          </UiButton>
          <UiButton variant="outline" @click="printReceipt">
            <Icon name="lucide:printer" class="h-4 w-4 mr-2" />
            {{ t('app.print') }}
          </UiButton>
          <UiButton 
            v-if="reparation.status === 'draft'"
            @click="updateStatus('received')"
            :loading="isUpdatingStatus"
          >
            <Icon name="lucide:check" class="h-4 w-4 mr-2" />
            {{ t('reparations.actions.confirm_repair') }}
          </UiButton>
          <UiButton 
            v-if="reparation.status === 'received'"
            @click="updateStatus('diagnosed')"
            :loading="isUpdatingStatus"
          >
            {{ t('reparations.actions.mark_diagnosed') }}
          </UiButton>
          <UiButton 
            v-if="reparation.status === 'diagnosed'"
            @click="updateStatus('in_progress')"
            :loading="isUpdatingStatus"
          >
            {{ t('reparations.actions.mark_in_progress') }}
          </UiButton>
          <UiButton 
            v-if="reparation.status === 'in_progress'"
            @click="updateStatus('completed')"
            :loading="isUpdatingStatus"
          >
            {{ t('reparations.actions.mark_completed') }}
          </UiButton>
          <UiButton 
            v-if="reparation.status === 'completed'"
            @click="updateStatus('returned')"
            :loading="isUpdatingStatus"
          >
            {{ t('reparations.actions.mark_returned') }}
          </UiButton>
        </div>
      </div>

      <!-- Draft Banner -->
      <div v-if="reparation.status === 'draft'" class="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between print:hidden">
        <div class="flex items-center gap-3">
          <Icon name="lucide:file-edit" class="h-6 w-6 text-amber-600" />
          <div>
            <h3 class="font-medium text-amber-800">{{ t('reparations.messages.draft_notice') }}</h3>
            <p class="text-sm text-amber-600">{{ t('reparations.messages.draft_notice_description') }}</p>
          </div>
        </div>
        <UiButton @click="navigateTo(`/reparations/${repId}/edit`)">
          <Icon name="lucide:pencil" class="h-4 w-4 mr-2" />
          {{ t('reparations.actions.continue_editing') }}
        </UiButton>
      </div>

      <!-- Details Card -->
      <div class="bg-white rounded-xl shadow-sm p-6 mt-6 print:shadow-none print:mt-0">
        <!-- Header -->
        <div class="flex justify-between items-start mb-8 pb-6 border-b">
          <div>
            <h2 class="text-xl font-bold text-gray-900">{{ t('reparations.title') }}</h2>
            <p class="text-sm text-gray-500 mt-1">{{ formatDate(reparation.createdAt) }}</p>
          </div>
          <span
            class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
            :class="getStatusColor(reparation.status)"
          >
            {{ t(`reparations.status.${reparation.status}`) }}
          </span>
        </div>

        <!-- Details Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <!-- Customer Info -->
          <div>
            <h3 class="text-sm font-medium text-gray-500 mb-1">{{ t('reparations.fields.customer') }}</h3>
            <p class="font-medium text-gray-900">{{ reparation.customer?.name || t('app.none') }}</p>
            <p v-if="reparation.customer?.phone" class="text-sm text-gray-600">{{ reparation.customer.phone }}</p>
          </div>

          <!-- Dates -->
          <div>
            <h3 class="text-sm font-medium text-gray-500 mb-1">{{ t('reparations.fields.received_date') }}</h3>
            <p>{{ formatDate(reparation.createdAt) }}</p>
            <p v-if="reparation.returnedAt" class="text-sm text-gray-600 mt-1">
              {{ t('reparations.fields.returned_date') }}: {{ formatDate(reparation.returnedAt) }}
            </p>
          </div>

          <!-- Handler -->
          <div>
            <h3 class="text-sm font-medium text-gray-500 mb-1">{{ t('reparations.fields.handled_by') }}</h3>
            <p>{{ reparation.handler?.name || t('app.none') }}</p>
          </div>
        </div>

        <!-- Reported Issue -->
        <div class="mb-8 p-4 bg-yellow-50 rounded-lg border border-yellow-100">
          <h3 class="text-sm font-medium text-yellow-800 mb-2">{{ t('reparations.fields.reported_issue') }}</h3>
          <p class="text-gray-900">{{ reparation.reportedIssue || '-' }}</p>
        </div>

        <!-- Diagnosis (if exists) -->
        <div v-if="reparation.diagnosis" class="mb-8 p-4 bg-purple-50 rounded-lg border border-purple-100">
          <h3 class="text-sm font-medium text-purple-800 mb-2">{{ t('reparations.fields.diagnosis') }}</h3>
          <p class="text-gray-900">{{ reparation.diagnosis }}</p>
        </div>

        <!-- Repair Notes (if exists) -->
        <div v-if="reparation.repairNotes" class="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <h3 class="text-sm font-medium text-blue-800 mb-2">{{ t('reparations.fields.repair_notes') }}</h3>
          <p class="text-gray-900">{{ reparation.repairNotes }}</p>
        </div>

        <!-- Parts & Materials -->
        <div v-if="reparation.items && reparation.items.length > 0" class="mb-8">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ t('reparations.fields.parts') }}</h3>
          <UiDataTable
            :columns="partsColumns"
            :data="reparation.items"
            :loading="false"
          >
            <template #name="{ item }">
              <div class="text-sm">
                <div class="font-medium text-gray-900">
                  {{ item.product?.name || 'Custom Part' }}
                </div>
                <div v-if="item.product?.sku" class="text-xs text-gray-500">SKU: {{ item.product.sku }}</div>
              </div>
            </template>

            <template #quantity="{ item }">
              <div class="text-sm text-gray-900 text-right">{{ item.quantity }}</div>
            </template>

            <template #unitCost="{ item }">
              <div class="text-sm text-gray-900 text-right">{{ formatCurrency(item.unitCost || 0) }}</div>
            </template>

            <template #lineTotal="{ item }">
              <div class="text-sm font-medium text-gray-900 text-right">
                {{ formatCurrency(item.lineTotal || 0) }}
              </div>
            </template>
          </UiDataTable>
        </div>

        <!-- Financial Summary -->
        <div class="border-t pt-6">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Costs -->
            <div class="space-y-2">
              <h3 class="text-sm font-medium text-gray-500 mb-3">{{ t('finance.costs') }}</h3>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">{{ t('reparations.fields.parts_cost') }}</span>
                <span class="font-medium">{{ formatCurrency(reparation.partsCost || 0) }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">{{ t('reparations.fields.labor_cost') }}</span>
                <span class="font-medium">{{ formatCurrency(reparation.laborCost || 0) }}</span>
              </div>
              <div class="flex justify-between text-sm font-semibold border-t pt-2">
                <span>{{ t('reparations.fields.total_cost') }}</span>
                <span>{{ formatCurrency(reparation.totalCost || 0) }}</span>
              </div>
            </div>

            <!-- Pricing -->
            <div class="space-y-2">
              <h3 class="text-sm font-medium text-gray-500 mb-3">{{ t('finance.pricing') }}</h3>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">{{ t('reparations.fields.price') }}</span>
                <span class="font-medium text-lg">{{ formatCurrency(reparation.price || 0) }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">{{ t('reparations.fields.deposit') }}</span>
                <span class="font-medium">{{ formatCurrency(reparation.depositAmount || 0) }}</span>
              </div>
            </div>

            <!-- Payment -->
            <div class="space-y-2">
              <h3 class="text-sm font-medium text-gray-500 mb-3">{{ t('payments.title') }}</h3>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">{{ t('reparations.fields.paid_amount') }}</span>
                <span class="font-medium">{{ formatCurrency(reparation.paidAmount || 0) }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">{{ t('sales.balance') }}</span>
                <span class="font-medium" :class="(reparation.price - reparation.paidAmount) > 0 ? 'text-red-600' : 'text-green-600'">
                  {{ formatCurrency((reparation.price || 0) - (reparation.paidAmount || 0)) }}
                </span>
              </div>
              <div class="flex justify-between text-sm font-semibold border-t pt-2">
                <span>{{ t('app.status') }}</span>
                <span :class="{
                  'text-green-600': reparation.paymentStatus === 'paid',
                  'text-yellow-600': reparation.paymentStatus === 'partial',
                  'text-red-600': reparation.paymentStatus === 'unpaid',
                }">
                  {{ t(`reparations.payment.${reparation.paymentStatus}`) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Payments History -->
        <div v-if="reparation.payments && reparation.payments.length > 0" class="mt-8 border-t pt-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ t('payments.title') }}</h3>
          <UiDataTable
            :columns="paymentsColumns"
            :data="reparation.payments"
            :loading="false"
          >
            <template #date="{ item }">
              <div class="text-sm text-gray-900">{{ formatDate(item.createdAt) }}</div>
            </template>

            <template #amount="{ item }">
              <div class="text-sm font-medium text-gray-900 text-right">
                {{ formatCurrency(item.amount) }}
              </div>
            </template>

            <template #method="{ item }">
              <div class="text-sm text-gray-600">{{ item.paymentMethod }}</div>
            </template>
          </UiDataTable>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media print {
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Remove rounded corners and borders for cleaner print */
  .rounded-xl, .rounded-lg {
    border-radius: 0 !important;
  }
}
</style>
