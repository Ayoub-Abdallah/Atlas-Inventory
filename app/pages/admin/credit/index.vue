<script setup lang="ts">
import type { Customer, Sale } from '~~/server/database/schema';

const { t, locale } = useI18n();
const toast = useToast();

// Fetch credit summary
const { data: creditData, pending, refresh } = await useFetch('/api/finance/credit-summary');

// Fetch customers for the modal
const { data: customers } = await useFetch('/api/customers');

// Payment modal state
const isPaymentModalOpen = ref(false);
const selectedSale = ref<any>(null);
const paymentForm = reactive({
  amount: 0,
  paymentMethod: 'cash',
  reference: '',
  notes: '',
});
const isSubmitting = ref(false);

// Customer modal state
const isCustomerModalOpen = ref(false);
const editingCustomer = ref<Customer | null>(null);
const customerForm = reactive({
  name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  notes: '',
  creditLimit: 0,
});

// Settings for currency
const { data: settings } = await useFetch('/api/settings');
const currency = computed(() => settings.value?.currency || 'EUR');

function formatCurrency(amount: number) {
  return new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency: currency.value,
  }).format(amount);
}

function formatDate(date: string | Date | null) {
  if (!date) return '—';
  return new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

function openPaymentModal(sale: any) {
  selectedSale.value = sale;
  const outstanding = (sale.totalAmount || 0) - (sale.paidAmount || 0);
  paymentForm.amount = outstanding;
  paymentForm.paymentMethod = 'cash';
  paymentForm.reference = '';
  paymentForm.notes = '';
  isPaymentModalOpen.value = true;
}

async function recordPayment() {
  if (!selectedSale.value) return;
  
  const outstanding = (selectedSale.value.totalAmount || 0) - (selectedSale.value.paidAmount || 0);
  
  if (paymentForm.amount <= 0) {
    toast.warning('Please enter a valid payment amount');
    return;
  }
  
  if (paymentForm.amount > outstanding + 0.01) {
    toast.warning(`Payment cannot exceed outstanding amount of ${formatCurrency(outstanding)}`);
    return;
  }

  isSubmitting.value = true;
  try {
    await $fetch('/api/payments', {
      method: 'POST',
      body: {
        saleId: selectedSale.value.id,
        amount: paymentForm.amount,
        paymentMethod: paymentForm.paymentMethod,
        reference: paymentForm.reference,
        notes: paymentForm.notes,
      },
    });
    toast.success('Payment recorded successfully');
    isPaymentModalOpen.value = false;
    refresh();
  } catch (error: any) {
    console.error('Failed to record payment:', error);
    toast.error(error.data?.message || 'Failed to record payment');
  } finally {
    isSubmitting.value = false;
  }
}

function openCustomerModal(customer?: Customer) {
  if (customer) {
    editingCustomer.value = customer;
    Object.assign(customerForm, {
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || '',
      notes: customer.notes || '',
      creditLimit: customer.creditLimit || 0,
    });
  } else {
    editingCustomer.value = null;
    Object.assign(customerForm, {
      name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      notes: '',
      creditLimit: 0,
    });
  }
  isCustomerModalOpen.value = true;
}

async function saveCustomer() {
  if (!customerForm.name.trim()) {
    toast.warning('Please enter a customer name');
    return;
  }

  isSubmitting.value = true;
  try {
    if (editingCustomer.value) {
      await $fetch(`/api/customers/${editingCustomer.value.id}`, {
        method: 'PUT',
        body: customerForm,
      });
      toast.success('Customer updated successfully');
    } else {
      await $fetch('/api/customers', {
        method: 'POST',
        body: customerForm,
      });
      toast.success('Customer added successfully');
    }
    isCustomerModalOpen.value = false;
    refresh();
  } catch (error) {
    console.error('Failed to save customer:', error);
    toast.error('Failed to save customer');
  } finally {
    isSubmitting.value = false;
  }
}

const paymentMethodOptions = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile', label: 'Mobile Payment' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' },
];

// Active tab
const activeTab = ref<'overview' | 'customers' | 'overdue'>('overview');
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-gray-900">{{ t('credit.title') }}</h1>
        <p class="text-xs text-gray-500">{{ t('credit.description') }}</p>
      </div>
      <button class="btn-primary" @click="openCustomerModal()">
        <Icon name="lucide:user-plus" class="h-3.5 w-3.5" />
        {{ t('credit.add_customer') }}
      </button>
    </div>

    <!-- Summary Cards -->
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
            <Icon name="lucide:wallet" class="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <p class="text-xs text-gray-500">{{ t('credit.total_receivables') }}</p>
            <p class="text-lg font-semibold text-gray-900">
              {{ formatCurrency(creditData?.summary?.totalReceivables || 0) }}
            </p>
          </div>
        </div>
      </div>

      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
            <Icon name="lucide:clock" class="h-5 w-5 text-yellow-600" />
          </div>
          <div>
            <p class="text-xs text-gray-500">{{ t('credit.partially_paid') }}</p>
            <p class="text-lg font-semibold text-gray-900">
              {{ formatCurrency(creditData?.summary?.totalPartiallyPaid || 0) }}
            </p>
            <p class="text-xs text-gray-400">
              {{ creditData?.summary?.partialSalesCount || 0 }} {{ t('credit.sales') }}
            </p>
          </div>
        </div>
      </div>

      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
            <Icon name="lucide:alert-circle" class="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p class="text-xs text-gray-500">{{ t('credit.unpaid') }}</p>
            <p class="text-lg font-semibold text-gray-900">
              {{ formatCurrency(creditData?.summary?.totalUnpaid || 0) }}
            </p>
            <p class="text-xs text-gray-400">
              {{ creditData?.summary?.unpaidSalesCount || 0 }} {{ t('credit.sales') }}
            </p>
          </div>
        </div>
      </div>

      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
            <Icon name="lucide:users" class="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <p class="text-xs text-gray-500">{{ t('credit.customers_with_debt') }}</p>
            <p class="text-lg font-semibold text-gray-900">
              {{ creditData?.summary?.customersWithDebt || 0 }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Overdue Alert -->
    <div
      v-if="(creditData?.summary?.overdueSalesCount || 0) > 0"
      class="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3"
    >
      <Icon name="lucide:alert-triangle" class="h-5 w-5 text-red-600" />
      <div class="flex-1">
        <p class="text-sm font-medium text-red-800">
          {{ creditData?.summary?.overdueSalesCount }} {{ t('credit.overdue_sales') }}
        </p>
        <p class="text-xs text-red-600">
          {{ t('credit.overdue_amount') }}: {{ formatCurrency(creditData?.summary?.overdueAmount || 0) }}
        </p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200">
      <nav class="flex gap-4">
        <button
          :class="[
            'pb-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          ]"
          @click="activeTab = 'overview'"
        >
          {{ t('credit.by_customer') }}
        </button>
        <button
          :class="[
            'pb-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'customers'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          ]"
          @click="activeTab = 'customers'"
        >
          {{ t('credit.all_customers') }}
        </button>
        <button
          :class="[
            'pb-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'overdue'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          ]"
          @click="activeTab = 'overdue'"
        >
          {{ t('credit.overdue') }}
          <span
            v-if="(creditData?.summary?.overdueSalesCount || 0) > 0"
            class="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600"
          >
            {{ creditData?.summary?.overdueSalesCount }}
          </span>
        </button>
      </nav>
    </div>

    <!-- Tab Content: By Customer -->
    <div v-if="activeTab === 'overview'" class="space-y-3">
      <div v-if="pending" class="flex justify-center py-8">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-gray-400" />
      </div>
      <div
        v-else-if="!creditData?.groupedByCustomer?.length"
        class="card p-8 text-center"
      >
        <Icon name="lucide:check-circle" class="mx-auto h-12 w-12 text-green-300" />
        <p class="mt-2 text-sm font-medium text-gray-900">{{ t('credit.no_outstanding') }}</p>
        <p class="text-xs text-gray-500">{{ t('credit.all_paid') }}</p>
      </div>
      <div
        v-else
        v-for="group in creditData?.groupedByCustomer"
        :key="group.customerId || 'walk-in'"
        class="card overflow-hidden"
      >
        <div class="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
          <div class="flex items-center gap-3">
            <div class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200">
              <Icon name="lucide:user" class="h-4 w-4 text-gray-600" />
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900">{{ group.customerName }}</p>
              <p class="text-xs text-gray-500">{{ group.sales.length }} {{ t('credit.unpaid_sales') }}</p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-sm font-semibold text-orange-600">
              {{ formatCurrency(group.totalOutstanding) }}
            </p>
            <p class="text-xs text-gray-500">{{ t('credit.outstanding') }}</p>
          </div>
        </div>
        <div class="divide-y divide-gray-100">
          <div
            v-for="sale in group.sales"
            :key="sale.id"
            class="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
          >
            <div>
              <p class="text-sm text-gray-900">
                {{ sale.invoiceNumber || sale.id.substring(0, 8) }}
              </p>
              <p class="text-xs text-gray-500">{{ formatDate(sale.createdAt) }}</p>
            </div>
            <div class="flex items-center gap-4">
              <div class="text-right">
                <p class="text-xs text-gray-500">
                  {{ formatCurrency(sale.paidAmount || 0) }} / {{ formatCurrency(sale.totalAmount) }}
                </p>
                <span
                  :class="[
                    'text-xs font-medium',
                    sale.paymentStatus === 'partial' ? 'text-yellow-600' : 'text-red-600',
                  ]"
                >
                  {{ formatCurrency((sale.totalAmount || 0) - (sale.paidAmount || 0)) }} {{ t('credit.remaining') }}
                </span>
              </div>
              <button
                class="btn-primary text-xs px-3 py-1.5"
                @click="openPaymentModal(sale)"
              >
                <Icon name="lucide:credit-card" class="h-3 w-3" />
                {{ t('credit.record_payment') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab Content: All Customers -->
    <div v-if="activeTab === 'customers'" class="card overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              {{ t('credit.customer') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              {{ t('credit.contact') }}
            </th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              {{ t('credit.balance') }}
            </th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              {{ t('credit.credit_limit') }}
            </th>
            <th class="px-4 py-3 w-24"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          <tr
            v-for="customer in creditData?.customersWithBalance"
            :key="customer.id"
            class="hover:bg-gray-50"
          >
            <td class="px-4 py-3">
              <p class="text-sm font-medium text-gray-900">{{ customer.name }}</p>
              <p v-if="customer.city" class="text-xs text-gray-500">{{ customer.city }}</p>
            </td>
            <td class="px-4 py-3">
              <p v-if="customer.phone" class="text-xs text-gray-600">{{ customer.phone }}</p>
              <p v-if="customer.email" class="text-xs text-gray-500">{{ customer.email }}</p>
            </td>
            <td class="px-4 py-3 text-right">
              <span class="text-sm font-medium text-orange-600">
                {{ formatCurrency(customer.currentBalance || 0) }}
              </span>
            </td>
            <td class="px-4 py-3 text-right text-sm text-gray-500">
              {{ customer.creditLimit ? formatCurrency(customer.creditLimit) : '—' }}
            </td>
            <td class="px-4 py-3">
              <button
                class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                @click="openCustomerModal(customer)"
              >
                <Icon name="lucide:pencil" class="h-3.5 w-3.5" />
              </button>
            </td>
          </tr>
          <tr v-if="!creditData?.customersWithBalance?.length">
            <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-500">
              {{ t('credit.no_customers_with_balance') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Tab Content: Overdue -->
    <div v-if="activeTab === 'overdue'" class="card overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              {{ t('credit.invoice') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              {{ t('credit.customer') }}
            </th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              {{ t('credit.outstanding') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              {{ t('credit.due_date') }}
            </th>
            <th class="px-4 py-3 w-32"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          <tr
            v-for="sale in creditData?.overdueSales"
            :key="sale.id"
            class="hover:bg-gray-50"
          >
            <td class="px-4 py-3">
              <p class="text-sm font-medium text-gray-900">
                {{ sale.invoiceNumber || sale.id.substring(0, 8) }}
              </p>
              <p class="text-xs text-gray-500">{{ formatDate(sale.createdAt) }}</p>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">
              {{ sale.customerName }}
            </td>
            <td class="px-4 py-3 text-right">
              <span class="text-sm font-medium text-red-600">
                {{ formatCurrency(sale.outstanding) }}
              </span>
            </td>
            <td class="px-4 py-3">
              <span class="text-sm text-red-600">{{ formatDate(sale.dueDate) }}</span>
            </td>
            <td class="px-4 py-3">
              <button
                class="btn-primary text-xs px-3 py-1.5"
                @click="openPaymentModal(sale)"
              >
                {{ t('credit.collect') }}
              </button>
            </td>
          </tr>
          <tr v-if="!creditData?.overdueSales?.length">
            <td colspan="5" class="px-4 py-8 text-center">
              <Icon name="lucide:check-circle" class="mx-auto h-8 w-8 text-green-300" />
              <p class="mt-2 text-sm text-gray-500">{{ t('credit.no_overdue') }}</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Payment Modal -->
    <UiModal
      v-model:open="isPaymentModalOpen"
      :title="t('credit.record_payment')"
      size="md"
    >
      <div v-if="selectedSale" class="space-y-4">
        <div class="rounded-lg bg-gray-50 p-3">
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">{{ t('credit.invoice') }}:</span>
            <span class="font-medium">{{ selectedSale.invoiceNumber || selectedSale.id?.substring(0, 8) }}</span>
          </div>
          <div class="flex justify-between text-sm mt-1">
            <span class="text-gray-500">{{ t('credit.total') }}:</span>
            <span class="font-medium">{{ formatCurrency(selectedSale.totalAmount || 0) }}</span>
          </div>
          <div class="flex justify-between text-sm mt-1">
            <span class="text-gray-500">{{ t('credit.already_paid') }}:</span>
            <span class="text-green-600">{{ formatCurrency(selectedSale.paidAmount || 0) }}</span>
          </div>
          <div class="flex justify-between text-sm mt-1 pt-1 border-t border-gray-200">
            <span class="text-gray-700 font-medium">{{ t('credit.remaining') }}:</span>
            <span class="font-semibold text-orange-600">
              {{ formatCurrency((selectedSale.totalAmount || 0) - (selectedSale.paidAmount || 0)) }}
            </span>
          </div>
        </div>

        <div>
          <label class="label">{{ t('credit.payment_amount') }} <span class="text-red-500">*</span></label>
          <UiInput
            v-model.number="paymentForm.amount"
            type="number"
            step="0.01"
            min="0"
            :max="(selectedSale.totalAmount || 0) - (selectedSale.paidAmount || 0)"
          />
        </div>

        <div>
          <label class="label">{{ t('credit.payment_method') }}</label>
          <select v-model="paymentForm.paymentMethod" class="input">
            <option
              v-for="method in paymentMethodOptions"
              :key="method.value"
              :value="method.value"
            >
              {{ method.label }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">{{ t('credit.reference') }}</label>
          <UiInput
            v-model="paymentForm.reference"
            :placeholder="t('credit.reference_placeholder')"
          />
        </div>

        <div>
          <label class="label">{{ t('credit.notes') }}</label>
          <textarea
            v-model="paymentForm.notes"
            class="input min-h-[60px] resize-none"
            :placeholder="t('credit.notes_placeholder')"
          />
        </div>
      </div>

      <template #footer>
        <button
          type="button"
          class="btn-secondary"
          :disabled="isSubmitting"
          @click="isPaymentModalOpen = false"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          class="btn-primary"
          :disabled="isSubmitting"
          @click="recordPayment"
        >
          <Icon
            v-if="isSubmitting"
            name="lucide:loader-2"
            class="h-3.5 w-3.5 animate-spin"
          />
          {{ t('credit.confirm_payment') }}
        </button>
      </template>
    </UiModal>

    <!-- Customer Modal -->
    <UiModal
      v-model:open="isCustomerModalOpen"
      :title="editingCustomer ? t('credit.edit_customer') : t('credit.add_customer')"
      size="md"
    >
      <form id="customer-form" class="space-y-4" @submit.prevent="saveCustomer">
        <div>
          <label class="label">{{ t('common.name') }} <span class="text-red-500">*</span></label>
          <UiInput v-model="customerForm.name" :placeholder="t('credit.customer_name')" autofocus />
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label class="label">{{ t('credit.phone') }}</label>
            <UiInput v-model="customerForm.phone" placeholder="+213 5XX XXX XXX" />
          </div>
          <div>
            <label class="label">{{ t('credit.email') }}</label>
            <UiInput v-model="customerForm.email" type="email" placeholder="email@example.com" />
          </div>
        </div>

        <div>
          <label class="label">{{ t('credit.address') }}</label>
          <UiInput v-model="customerForm.address" :placeholder="t('credit.address_placeholder')" />
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label class="label">{{ t('credit.city') }}</label>
            <UiInput v-model="customerForm.city" :placeholder="t('credit.city')" />
          </div>
          <div>
            <label class="label">{{ t('credit.credit_limit') }}</label>
            <UiInput
              v-model.number="customerForm.creditLimit"
              type="number"
              min="0"
              step="100"
              placeholder="0 = No limit"
            />
          </div>
        </div>

        <div>
          <label class="label">{{ t('credit.notes') }}</label>
          <textarea
            v-model="customerForm.notes"
            class="input min-h-[60px] resize-none"
            :placeholder="t('credit.notes_placeholder')"
          />
        </div>
      </form>

      <template #footer>
        <button
          type="button"
          class="btn-secondary"
          :disabled="isSubmitting"
          @click="isCustomerModalOpen = false"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          type="submit"
          form="customer-form"
          class="btn-primary"
          :disabled="isSubmitting"
        >
          <Icon
            v-if="isSubmitting"
            name="lucide:loader-2"
            class="h-3.5 w-3.5 animate-spin"
          />
          {{ editingCustomer ? t('common.update') : t('common.add') }}
        </button>
      </template>
    </UiModal>
  </div>
</template>
