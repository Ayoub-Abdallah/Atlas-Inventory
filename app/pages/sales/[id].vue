<script setup lang="ts">
definePageMeta({
  layout: 'default',
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { showToast } = useToast();

const saleId = route.params.id as string;

// Fetch sale details
const { data: sale, pending, error, refresh } = await useFetch(`/api/sales/${saleId}`);

// Fetch returns for this sale
const { data: returns } = await useFetch(`/api/returns?saleId=${saleId}`);

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
const formatDate = (date: Date | string) => {
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

// Print invoice
const printInvoice = () => {
  window.print();
};

// Return modal
import ReturnForm from '../../components/returns/ReturnForm.vue';
const openReturn = ref(false);
async function onProcessed() {
  // reload page data after processing
  await refresh();
}
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
      <h3 class="text-lg font-medium text-red-800 mb-2">{{ t('errors.sale_not_found') }}</h3>
      <p class="text-sm text-red-600 mb-4">{{ t('errors.sale_not_found_description') }}</p>
      <UiButton variant="outline" @click="navigateTo('/sales')">
        <Icon name="lucide:arrow-left" class="h-4 w-4 mr-2" />
        {{ t('sales.back_to_sales') }}
      </UiButton>
    </div>

    <!-- Sale Details -->
    <div v-else-if="sale" class="print:bg-white">
      <!-- Header -->
      <div class="flex items-center justify-between print:hidden">
        <div class="flex items-center gap-4">
          <UiButton variant="ghost" size="sm" @click="navigateTo('/sales')">
            <Icon name="lucide:arrow-left" class="h-4 w-4" />
          </UiButton>
          <div>
            <h1 class="text-2xl font-bold text-gray-900">
              {{ t('sales.sale_details') }}
            </h1>
            <p class="text-sm text-gray-500 font-mono">{{ sale.id }}</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <UiButton variant="outline" @click="printInvoice">
            <Icon name="lucide:printer" class="h-4 w-4 mr-2" />
            {{ t('app.print') }}
          </UiButton>
          <UiButton @click="openReturn = true">
            <Icon name="lucide:corner-down-left" class="h-4 w-4 mr-2" />
            {{ t('returns.create') }}
          </UiButton>
        </div>
      </div>

      <!-- Invoice Card -->
      <div class="bg-white rounded-xl shadow-sm p-6 mt-6 print:shadow-none print:mt-0">
        <!-- Invoice Header -->
        <div class="flex justify-between items-start mb-8 pb-6 border-b">
          <div>
            <h2 class="text-xl font-bold text-gray-900">{{ t('sales.invoice') }}</h2>
            <p class="text-sm text-gray-500 mt-1">{{ formatDate(sale.createdAt) }}</p>
          </div>
          <span
            class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
            :class="getStatusColor(sale.status)"
          >
            {{ t(`sales.${sale.status}`) }}
          </span>
        </div>

        <!-- Details Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div>
            <h3 class="text-sm font-medium text-gray-500 mb-1">{{ t('sales.sale_id') }}</h3>
            <p class="font-mono text-sm">{{ sale.id }}</p>
          </div>
          <div>
            <h3 class="text-sm font-medium text-gray-500 mb-1">{{ t('suppliers.title') }}</h3>
            <p>{{ sale.supplier?.name || '-' }}</p>
          </div>
          <div v-if="sale.confirmedAt">
            <h3 class="text-sm font-medium text-gray-500 mb-1">{{ t('sales.confirmed_at') }}</h3>
            <p>{{ formatDate(sale.confirmedAt) }}</p>
          </div>
        </div>

        <!-- Client Info -->
        <div v-if="sale.clientName || sale.clientInfo" class="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <h3 class="text-sm font-medium text-blue-800 mb-2">{{ t('sales.client_info') }}</h3>
          <p v-if="sale.clientName" class="font-medium text-blue-900">{{ sale.clientName }}</p>
          <p v-if="sale.clientInfo" class="text-sm text-blue-700 mt-1 whitespace-pre-line">{{ sale.clientInfo }}</p>
        </div>

        <!-- Notes -->
        <div v-if="sale.notes" class="mb-8 p-4 bg-gray-50 rounded-lg">
          <h3 class="text-sm font-medium text-gray-700 mb-1">{{ t('app.notes') }}</h3>
          <p class="text-sm text-gray-600">{{ sale.notes }}</p>
        </div>

        <!-- Items Table -->
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b">
                <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">{{ t('products.product') }}</th>
                <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">SKU</th>
                <th class="py-3 px-4 text-right text-sm font-medium text-gray-500">{{ t('products.price') }}</th>
                <th class="py-3 px-4 text-right text-sm font-medium text-gray-500">{{ t('movements.quantity') }}</th>
                <th class="py-3 px-4 text-right text-sm font-medium text-gray-500">{{ t('sales.line_total') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in sale.items"
                :key="item.id"
                class="border-b last:border-0"
              >
                <td class="py-3 px-4">
                  <span class="font-medium text-gray-900">{{ item.product?.name || 'Unknown' }}</span>
                  <span v-if="item.variant" class="text-gray-500"> - {{ item.variant.name }}</span>
                </td>
                <td class="py-3 px-4 text-sm text-gray-500 font-mono">
                  {{ item.variant?.sku || item.product?.sku || '-' }}
                </td>
                <td class="py-3 px-4 text-right text-sm text-gray-600">
                  {{ formatCurrency(item.unitPrice) }}
                </td>
                <td class="py-3 px-4 text-right text-sm text-gray-600">
                  {{ item.quantity }}
                </td>
                <td class="py-3 px-4 text-right font-medium text-gray-900">
                  {{ formatCurrency(item.lineTotal) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Totals -->
        <div class="mt-8 pt-6 border-t">
          <div class="flex justify-end">
            <dl class="space-y-3 w-64">
              <div class="flex justify-between">
                <dt class="text-sm text-gray-500">{{ t('sales.subtotal') }}</dt>
                <dd class="text-sm font-medium text-gray-900">
                  {{ formatCurrency((sale.totalAmount || 0) - (sale.taxAmount || 0)) }}
                </dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-sm text-gray-500">{{ t('sales.tax') }}</dt>
                <dd class="text-sm font-medium text-gray-900">
                  {{ formatCurrency(sale.taxAmount || 0) }}
                </dd>
              </div>
              <div class="flex justify-between pt-3 border-t">
                <dt class="text-base font-bold text-gray-900">{{ t('sales.total') }}</dt>
                <dd class="text-base font-bold text-primary-600">
                  {{ formatCurrency(sale.totalAmount || 0) }}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <!-- Returns History Section -->
        <div v-if="returns && returns.length > 0" class="mt-8 pt-8 border-t print:hidden">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ t('returns.title') }}</h3>
          <div class="space-y-4">
            <div
              v-for="returnRecord in returns"
              :key="returnRecord.id"
              class="p-4 border border-gray-200 rounded-lg"
            >
              <div class="flex items-center justify-between mb-3">
                <div>
                  <div class="font-mono text-sm text-gray-600">{{ returnRecord.id }}</div>
                  <div class="text-sm text-gray-500">{{ formatDate(returnRecord.createdAt) }}</div>
                </div>
                <span
                  class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                  :class="{
                    'bg-green-100 text-green-800': returnRecord.status === 'processed',
                    'bg-yellow-100 text-yellow-800': returnRecord.status === 'pending',
                    'bg-gray-100 text-gray-800': returnRecord.status === 'cancelled'
                  }"
                >
                  {{ t(`returns.status.${returnRecord.status}`) }}
                </span>
              </div>

              <!-- Return Items -->
              <div v-if="returnRecord.items && returnRecord.items.length > 0" class="space-y-2">
                <div
                  v-for="item in returnRecord.items"
                  :key="item.id"
                  class="flex items-center justify-between text-sm"
                >
                  <div class="flex-1">
                    <span class="font-medium">{{ item.product?.name || 'Product' }}</span>
                    <span v-if="item.variant" class="text-gray-500"> - {{ item.variant.name }}</span>
                  </div>
                  <div class="flex items-center gap-4 text-gray-600">
                    <span>Qty: {{ item.quantity }}</span>
                    <span class="font-medium">{{ formatCurrency(item.lineTotal || 0) }}</span>
                  </div>
                </div>
              </div>

              <!-- Return Totals -->
              <div class="mt-3 pt-3 border-t flex justify-between items-center">
                <div class="text-sm text-gray-600">
                  {{ returnRecord.reason || t('returns.type.' + returnRecord.type) }}
                  <span v-if="returnRecord.restocked" class="ml-2 text-green-600">• {{ t('returns.fields.restock') }}</span>
                </div>
                <div class="text-right">
                  <div class="text-sm font-semibold text-gray-900">
                    {{ formatCurrency(returnRecord.totalAmount || 0) }}
                  </div>
                  <div v-if="returnRecord.refundedAmount > 0" class="text-xs text-gray-600">
                    {{ t('returns.fields.refund_amount') }}: {{ formatCurrency(returnRecord.refundedAmount) }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Summary -->
          <div v-if="returns.filter((r: any) => r.status === 'processed').length > 0" class="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
            <div class="flex justify-between text-sm">
              <span class="font-medium text-red-800">{{ t('returns.title') }} ({{ t('returns.status.processed') }})</span>
              <span class="font-semibold text-red-900">
                -{{ formatCurrency(returns.filter((r: any) => r.status === 'processed').reduce((sum: number, r: any) => sum + (r.totalAmount || 0), 0)) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
    <ReturnForm :sale="sale" v-model:open="openReturn" @processed="onProcessed" />
</template>



<style scoped>
@media print {
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .rounded-xl, .rounded-lg {
    border-radius: 0 !important;
  }
}
</style>
