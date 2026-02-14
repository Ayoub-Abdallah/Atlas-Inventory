<script setup lang="ts">
import { Line, Bar, Doughnut } from 'vue-chartjs';
import type { ChartData, ChartOptions } from 'chart.js';

definePageMeta({
  layout: 'default',
});

const { t } = useI18n();

// State
const dateRange = ref('30d');
const customFrom = ref('');
const customTo = ref('');
const sourceFilter = ref(''); // '', 'product', 'reparation'
const isLoading = ref(true);

// Add 'Today' to date range
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);

// Fetch data
const { data: summaryData, refresh: refreshSummary } = await useFetch('/api/finance/summary', {
  query: computed(() => {
    if (dateRange.value === 'custom' && customFrom.value && customTo.value) {
      return { from: customFrom.value, to: customTo.value, ...(sourceFilter.value ? { source: sourceFilter.value } : {}) };
    }
    const now = new Date();
    let from = new Date();
    
    switch (dateRange.value) {
      case 'today':
        from.setHours(0, 0, 0, 0);
        break;
      case '30d':
        from.setDate(from.getDate() - 30);
        break;
      case '90d':
        from.setDate(from.getDate() - 90);
        break;
      case '1y':
        from.setFullYear(from.getFullYear() - 1);
        break;
    }
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    const toLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return { from: toLocal(from), to: toLocal(now), ...(sourceFilter.value ? { source: sourceFilter.value } : {}) };
  }),
});

const { data: chartData, refresh: refreshCharts } = await useFetch('/api/finance/chart-data', {
  query: computed(() => {
    const srcParam = sourceFilter.value ? { source: sourceFilter.value } : {};
    // Always include today in the range if 'today' is selected
    if (dateRange.value === 'today') {
      const now = new Date();
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const toLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return { from: toLocal(from), to: toLocal(now), ...srcParam };
    }
    return { range: dateRange.value, ...srcParam };
  }),
});

// Fetch settings for currency
const { data: settings } = await useFetch('/api/settings');
const currency = computed(() => settings.value?.currency || 'DZD');

isLoading.value = false;

// Watch date range and source filter changes
watch([dateRange, sourceFilter], () => {
  if (dateRange.value !== 'custom') {
    refreshSummary();
    refreshCharts();
  }
});

const applyCustomRange = () => {
  if (customFrom.value && customTo.value) {
    refreshSummary();
    refreshCharts();
  }
};

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.value,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatCurrencyFull = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.value,
  }).format(value);
};

// Revenue/Profit Chart
const revenueChartData = computed<ChartData<'line'>>(() => {
  const timeseries = chartData.value?.timeseries || [];
  return {
    labels: timeseries.map((d: any) => {
      const date = new Date(d.date);
      return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
    }),
    datasets: [
      {
        label: t('finance.revenue'),
        data: timeseries.map((d: any) => d.revenue),
        borderColor: '#4F46E5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: t('finance.profit'),
        data: timeseries.map((d: any) => d.profit),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };
});

const revenueChartOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top',
    },
    tooltip: {
      mode: 'index',
      intersect: false,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: (value) => formatCurrency(value as number),
      },
    },
  },
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false,
  },
};

// Top Products Chart
const topProductsChartData = computed<ChartData<'bar'>>(() => {
  const products = summaryData.value?.topProducts || [];
  return {
    labels: products.map((p: any) => p.name.substring(0, 20)),
    datasets: [
      {
        label: t('finance.revenue'),
        data: products.map((p: any) => p.revenue),
        backgroundColor: '#4F46E5',
        borderRadius: 4,
      },
    ],
  };
});

const topProductsChartOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      ticks: {
        callback: (value) => formatCurrency(value as number),
      },
    },
  },
};

// Category Distribution Chart
const categoryChartData = computed<ChartData<'doughnut'>>(() => {
  const categories = chartData.value?.categoryDistribution || [];
  return {
    labels: categories.map((c: any) => c.name),
    datasets: [
      {
        data: categories.map((c: any) => c.revenue),
        backgroundColor: categories.map((c: any) => c.color || '#6B7280'),
        borderWidth: 0,
      },
    ],
  };
});

const categoryChartOptions: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'right',
    },
  },
};

// Export functions
const exportCSV = () => {
  const summary = summaryData.value?.summary;
  const products = summaryData.value?.topProducts || [];
  
  let csv = 'Metric,Value\n';
  csv += `${t('finance.revenue')},${summary?.totalRevenue || 0}\n`;
  csv += `${t('finance.gross_profit')},${summary?.grossProfit || 0}\n`;
  csv += `${t('finance.costs')},${summary?.totalCost || 0}\n`;
  csv += `${t('finance.taxes_collected')},${summary?.taxesCollected || 0}\n`;
  csv += `${t('finance.total_sales')},${summary?.numberOfSales || 0}\n`;
  csv += `${t('finance.avg_order_value')},${summary?.avgOrderValue || 0}\n`;
  csv += '\n';
  csv += `${t('finance.top_products')}\n`;
  csv += `${t('app.name')},${t('finance.revenue')},${t('finance.units_sold')}\n`;
  products.forEach((p: any) => {
    csv += `"${p.name}",${p.revenue},${p.unitsSold}\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `finances_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
};

const exportPDF = () => {
  window.print();
};

// Format date
const formatDate = (date: Date | string) => {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
};

// Computed date range parameters
const dateParams = computed(() => {
  const now = new Date();
  let from: Date;
  let to = now;

  switch (dateRange.value) {
    case 'today':
      from = new Date();
      from.setHours(0, 0, 0, 0);
      break;
    case '30d':
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    case 'custom':
      from = customFrom.value ? new Date(customFrom.value) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      to = customTo.value ? new Date(customTo.value) : now;
      break;
    default:
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return {
    startDate: from.toISOString(),
    endDate: to.toISOString(),
  };
});
</script>

<template>
  <div class="space-y-6 print:space-y-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">
          {{ t('finance.title') }}
        </h1>
        <p class="mt-1 text-sm text-gray-500">
          {{ t('finance.description') }}
        </p>
      </div>
      
      <div class="flex items-center gap-3">
        <!-- Source Type Filter -->
        <select
          v-model="sourceFilter"
          class="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="">{{ t('sales.all_types') }}</option>
          <option value="product">{{ t('sales.product_sales') }}</option>
          <option value="reparation">{{ t('sales.reparation_sales') }}</option>
        </select>

        <!-- Date Range Selector -->
        <select
          v-model="dateRange"
          class="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="today">{{ t('finance.today') }}</option>
          <option value="30d">{{ t('finance.last_30_days') }}</option>
          <option value="90d">{{ t('finance.last_90_days') }}</option>
          <option value="1y">{{ t('finance.last_year') }}</option>
          <option value="custom">{{ t('finance.custom_range') }}</option>
        </select>
        
        <!-- Custom Range Inputs -->
        <template v-if="dateRange === 'custom'">
          <input
            v-model="customFrom"
            type="date"
            class="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <span class="text-gray-400">→</span>
          <input
            v-model="customTo"
            type="date"
            class="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <UiButton size="sm" @click="applyCustomRange">
            {{ t('finance.apply') }}
          </UiButton>
        </template>
        
        <!-- Export Buttons -->
        <UiButton variant="outline" size="sm" @click="exportCSV">
          <Icon name="lucide:download" class="h-4 w-4 mr-2" />
          {{ t('finance.export_csv') }}
        </UiButton>
        <UiButton variant="outline" size="sm" @click="exportPDF">
          <Icon name="lucide:file-text" class="h-4 w-4 mr-2" />
          {{ t('finance.export_pdf') }}
        </UiButton>
      </div>
    </div>

    <!-- Print Header -->
    <div class="hidden print:block">
      <h1 class="text-xl font-bold">{{ t('finance.title') }}</h1>
      <p class="text-sm text-gray-500">
        {{ formatDate(summaryData?.period?.from || new Date()) }} - 
        {{ formatDate(summaryData?.period?.to || new Date()) }}
      </p>
    </div>

    <!-- KPI Cards - Row 1: Revenue & Profit -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <UiStatCard
        :title="t('finance.revenue')"
        :value="formatCurrency(summaryData?.summary?.totalRevenue || 0)"
        icon="lucide:trending-up"
        icon-color="primary"
      />
      <UiStatCard
        :title="t('finance.actual_income')"
        :value="formatCurrency(summaryData?.summary?.actualIncome || 0)"
        :subtitle="t('finance.paid_only')"
        icon="lucide:banknote"
        icon-color="success"
      />
      <UiStatCard
        :title="t('finance.pending_receivables')"
        :value="formatCurrency(summaryData?.summary?.pendingReceivables || 0)"
        :subtitle="t('finance.unpaid_credit')"
        icon="lucide:clock"
        icon-color="warning"
      />
      <UiStatCard
        :title="t('finance.total_sales')"
        :value="(summaryData?.summary?.numberOfSales || 0).toString()"
        icon="lucide:shopping-bag"
        icon-color="default"
      />
    </div>

    <!-- KPI Cards - Row 2: Profit & Loss -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <UiStatCard
        :title="t('finance.gross_profit')"
        :value="formatCurrency(summaryData?.summary?.grossProfit || 0)"
        icon="lucide:wallet"
        icon-color="success"
      />
      <UiStatCard
        :title="t('finance.total_expenses')"
        :value="formatCurrency(summaryData?.summary?.totalExpenses || 0)"
        icon="lucide:trending-down"
        icon-color="error"
      />
      <UiStatCard
        :title="t('finance.net_profit')"
        :value="formatCurrency(summaryData?.summary?.netProfit || 0)"
        :class="{ 'ring-2 ring-green-200': (summaryData?.summary?.netProfit || 0) > 0, 'ring-2 ring-red-200': (summaryData?.summary?.netProfit || 0) < 0 }"
        icon="lucide:calculator"
        :icon-color="(summaryData?.summary?.netProfit || 0) >= 0 ? 'success' : 'error'"
      />
      <UiStatCard
        :title="t('finance.taxes_collected')"
        :value="formatCurrency(summaryData?.summary?.taxesCollected || 0)"
        icon="lucide:receipt"
        icon-color="default"
      />
    </div>

    <!-- Reparation Metrics Row -->
    <div v-if="(summaryData?.summary?.numberOfReparations || 0) > 0" class="bg-white border border-gray-200 rounded-xl p-6">
      <div class="flex items-center gap-2 mb-4">
        <Icon name="lucide:wrench" class="h-4 w-4 text-indigo-600" />
        <h3 class="font-semibold text-gray-900">{{ t('finance.reparations_overview') }}</h3>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="text-center p-4 bg-indigo-50 rounded-lg">
          <p class="text-2xl font-bold text-indigo-600 font-mono">
            {{ summaryData?.summary?.numberOfReparations || 0 }}
          </p>
          <p class="text-sm text-indigo-700">{{ t('finance.reparations_count') }}</p>
        </div>
        <div class="text-center p-4 bg-indigo-50 rounded-lg">
          <p class="text-2xl font-bold text-indigo-600 font-mono">
            {{ formatCurrency(summaryData?.summary?.reparationsRevenue || 0) }}
          </p>
          <p class="text-sm text-indigo-700">{{ t('finance.reparations_revenue') }}</p>
        </div>
        <div class="text-center p-4 bg-indigo-50 rounded-lg">
          <p class="text-2xl font-bold text-indigo-600 font-mono">
            {{ formatCurrency(summaryData?.summary?.reparationsCost || 0) }}
          </p>
          <p class="text-sm text-indigo-700">{{ t('finance.reparations_cost') }}</p>
        </div>
        <div class="text-center p-4 rounded-lg" :class="(summaryData?.summary?.reparationsProfit || 0) >= 0 ? 'bg-emerald-50' : 'bg-red-50'">
          <p class="text-2xl font-bold font-mono" :class="(summaryData?.summary?.reparationsProfit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'">
            {{ formatCurrency(summaryData?.summary?.reparationsProfit || 0) }}
          </p>
          <p class="text-sm" :class="(summaryData?.summary?.reparationsProfit || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'">{{ t('finance.reparations_profit') }}</p>
        </div>
      </div>
    </div>

    <!-- Payment Status Overview -->
    <div class="bg-white border border-gray-200 rounded-xl p-6">
      <h3 class="font-semibold text-gray-900 mb-4">{{ t('finance.payment_status') }}</h3>
      <div class="grid grid-cols-3 gap-4">
        <div class="text-center p-4 bg-green-50 rounded-lg">
          <p class="text-2xl font-bold text-green-600">
            {{ summaryData?.salesByPaymentStatus?.paid || 0 }}
          </p>
          <p class="text-sm text-green-700">{{ t('finance.fully_paid') }}</p>
        </div>
        <div class="text-center p-4 bg-yellow-50 rounded-lg">
          <p class="text-2xl font-bold text-yellow-600">
            {{ summaryData?.salesByPaymentStatus?.partial || 0 }}
          </p>
          <p class="text-sm text-yellow-700">{{ t('finance.partial_payments') }}</p>
        </div>
        <div class="text-center p-4 bg-red-50 rounded-lg">
          <p class="text-2xl font-bold text-red-600">
            {{ summaryData?.salesByPaymentStatus?.unpaid || 0 }}
          </p>
          <p class="text-sm text-red-700">{{ t('finance.unpaid_sales') }}</p>
        </div>
      </div>
      
      <!-- Link to Credit page -->
      <div class="mt-4 pt-4 border-t border-gray-100 flex justify-end">
        <NuxtLink to="/credit" class="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
          {{ t('finance.view_credit_details') }}
          <Icon name="lucide:arrow-right" class="h-4 w-4" />
        </NuxtLink>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Revenue/Profit Chart -->
      <div class="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6">
        <h3 class="font-semibold text-gray-900 mb-4">{{ t('finance.revenue_chart') }}</h3>
        <div class="h-72">
          <Line
            v-if="chartData?.timeseries?.length"
            :data="revenueChartData"
            :options="revenueChartOptions"
          />
          <div v-else class="h-full flex items-center justify-center text-gray-400">
            {{ t('finance.no_data') }}
          </div>
        </div>
      </div>

      <!-- Category Distribution -->
      <div class="bg-white border border-gray-200 rounded-xl p-6">
        <h3 class="font-semibold text-gray-900 mb-4">{{ t('finance.sales_by_category') }}</h3>
        <div class="h-72">
          <Doughnut
            v-if="chartData?.categoryDistribution?.length"
            :data="categoryChartData"
            :options="categoryChartOptions"
          />
          <div v-else class="h-full flex items-center justify-center text-gray-400">
            {{ t('finance.no_data') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Top Products & Recent Sales -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Top Products Chart -->
      <div class="bg-white border border-gray-200 rounded-xl p-6">
        <h3 class="font-semibold text-gray-900 mb-4">{{ t('finance.top_products') }}</h3>
        <div class="h-80">
          <Bar
            v-if="summaryData?.topProducts?.length"
            :data="topProductsChartData"
            :options="topProductsChartOptions"
          />
          <div v-else class="h-full flex items-center justify-center text-gray-400">
            {{ t('finance.no_data') }}
          </div>
        </div>
      </div>

      <!-- Top Products Table -->
      <div class="bg-white border border-gray-200 rounded-xl p-6">
        <h3 class="font-semibold text-gray-900 mb-4">{{ t('finance.top_products') }}</h3>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="text-left text-xs text-gray-500 uppercase border-b">
                <th class="pb-3 font-medium">{{ t('app.name') }}</th>
                <th class="pb-3 font-medium text-right">{{ t('finance.revenue') }}</th>
                <th class="pb-3 font-medium text-right">{{ t('finance.units_sold') }}</th>
                <th class="pb-3 font-medium text-right">{{ t('finance.avg_price') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="product in summaryData?.topProducts?.slice(0, 10)"
                :key="product.id"
                class="text-sm"
              >
                <td class="py-3 text-gray-900 font-medium">{{ product.name }}</td>
                <td class="py-3 text-right text-gray-900">{{ formatCurrencyFull(product.revenue) }}</td>
                <td class="py-3 text-right text-gray-600">{{ product.unitsSold }}</td>
                <td class="py-3 text-right text-gray-600">{{ formatCurrencyFull(product.avgPrice) }}</td>
              </tr>
            </tbody>
          </table>
          <div
            v-if="!summaryData?.topProducts?.length"
            class="py-8 text-center text-gray-400"
          >
            {{ t('finance.no_data') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Sales -->
    <div class="bg-white border border-gray-200 rounded-xl p-6">
      <h3 class="font-semibold text-gray-900 mb-4">{{ t('finance.recent_sales') }}</h3>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-left text-xs text-gray-500 uppercase border-b">
              <th class="pb-3 font-medium">{{ t('sales.type') }}</th>
              <th class="pb-3 font-medium">{{ t('sales.sale_date') }}</th>
              <th class="pb-3 font-medium">{{ t('sales.customer') }}</th>
              <th class="pb-3 font-medium text-right">{{ t('sales.total') }}</th>
              <th class="pb-3 font-medium text-right">{{ t('sales.paid') }}</th>
              <th class="pb-3 font-medium text-center">{{ t('sales.payment_status') }}</th>
              <th class="pb-3 font-medium text-center">{{ t('app.status') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="sale in summaryData?.recentSales"
              :key="sale.id"
              class="text-sm hover:bg-gray-50 cursor-pointer"
              @click="navigateTo(sale.sourceType === 'reparation' ? `/reparations/${sale.id}` : `/sales/${sale.id}`)"
            >
              <td class="py-3">
                <span
                  v-if="sale.sourceType === 'reparation'"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                >
                  <Icon name="lucide:wrench" class="h-3 w-3" />
                  {{ t('sales.reparation') }}
                </span>
                <span
                  v-else
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                >
                  <Icon name="lucide:package" class="h-3 w-3" />
                  {{ t('sales.product') }}
                </span>
              </td>
              <td class="py-3 text-gray-900">
                {{ formatDate(sale.createdAt) }}
              </td>
              <td class="py-3 text-gray-600">
                {{ sale.customerName || sale.supplierName || '-' }}
              </td>
              <td class="py-3 text-right text-gray-900 font-medium">
                {{ formatCurrencyFull(sale.totalAmount) }}
              </td>
              <td class="py-3 text-right text-gray-600">
                {{ formatCurrencyFull(sale.paidAmount || 0) }}
              </td>
              <td class="py-3 text-center">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="{
                    'bg-green-100 text-green-800': sale.paymentStatus === 'paid',
                    'bg-yellow-100 text-yellow-800': sale.paymentStatus === 'partial',
                    'bg-red-100 text-red-800': sale.paymentStatus === 'unpaid',
                  }"
                >
                  {{ sale.paymentStatus === 'paid' ? t('sales.paid') : 
                     sale.paymentStatus === 'partial' ? t('sales.partial') : 
                     t('sales.unpaid') }}
                </span>
              </td>
              <td class="py-3 text-center">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="{
                    'bg-green-100 text-green-800': sale.status === 'confirmed',
                    'bg-yellow-100 text-yellow-800': sale.status === 'draft',
                    'bg-red-100 text-red-800': sale.status === 'cancelled',
                  }"
                >
                  {{ t(`sales.${sale.status}`) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <div
          v-if="!summaryData?.recentSales?.length"
          class="py-8 text-center text-gray-400"
        >
          {{ t('finance.no_data') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media print {
  .print\:hidden {
    display: none !important;
  }
  .print\:block {
    display: block !important;
  }
}
</style>
