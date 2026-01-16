<script setup lang="ts">
import type { Customer } from '~~/server/database/schema';

definePageMeta({
  layout: 'default',
});

const { t } = useI18n();
const router = useRouter();
const { showToast } = useToast();

// Sale draft composable
const saleDraft = useSaleDraft();
const { 
  items, 
  selectedSupplierId, 
  notes,
  subtotal,
  taxTotal,
  total,
  itemCount,
  clearDraft,
  removeItem,
  updateQuantity,
  updateItemPrice,
} = saleDraft;

// Fetch suppliers for dropdown
const { data: suppliersData } = await useFetch('/api/suppliers');
const suppliers = computed(() => suppliersData.value || []);

// Fetch customers for dropdown
const { data: customersData, refresh: refreshCustomers } = await useFetch('/api/customers');
const customers = computed(() => customersData.value || []);

// Fetch settings for currency
const { data: settings } = await useFetch('/api/settings');
const currency = computed(() => settings.value?.currency || 'DZD');

// State
const confirming = ref(false);
const showClearConfirm = ref(false);
const showConfirmModal = ref(false);
const clientName = ref('');
const clientInfo = ref('');

// Payment Type: 'immediate' or 'credit'
const paymentType = ref<'immediate' | 'credit'>('immediate');

// Customer selection with search
const customerSearchQuery = ref('');
const selectedCustomerId = ref<string | null>(null);
const isCustomerDropdownOpen = ref(false);
const paidAmount = ref(0);
const paymentMethod = ref('cash');
const dueDate = ref('');
const showNewCustomerForm = ref(false);
const newCustomerName = ref('');
const newCustomerPhone = ref('');

// Editable final amount for discounts (credit sales)
const editableFinalAmount = ref(0);
const isEditingFinalAmount = ref(false);

// Filtered customers based on search
const filteredCustomers = computed(() => {
  if (!customerSearchQuery.value.trim()) {
    return customers.value || [];
  }
  const query = customerSearchQuery.value.toLowerCase();
  return (customers.value || []).filter((c: Customer) => 
    c.name.toLowerCase().includes(query) ||
    (c.phone && c.phone.includes(query)) ||
    (c.email && c.email.toLowerCase().includes(query))
  );
});

// Computed payment status
const paymentStatus = computed(() => {
  if (paymentType.value === 'immediate') return 'paid';
  if (paidAmount.value >= finalAmount.value) return 'paid';
  if (paidAmount.value > 0) return 'partial';
  return 'unpaid';
});

// Final amount (can be edited for discounts on credit sales)
const finalAmount = computed(() => {
  if (paymentType.value === 'credit' && isEditingFinalAmount.value) {
    return editableFinalAmount.value;
  }
  return total.value;
});

// Outstanding balance for credit sales
const outstandingBalance = computed(() => {
  if (paymentType.value === 'immediate') return 0;
  return Math.max(0, finalAmount.value - paidAmount.value);
});

// Selected customer info
const selectedCustomer = computed(() => 
  customers.value.find((c: Customer) => c.id === selectedCustomerId.value)
);

// Payment methods
const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile', label: 'Mobile Payment' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' },
];

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.value,
  }).format(value);
};

// Open confirmation modal
const openConfirmModal = () => {
  if (items.value.length === 0) {
    showToast(t('sales.no_items_error'), 'error');
    return;
  }
  // Reset to immediate payment by default
  paymentType.value = 'immediate';
  paidAmount.value = 0;
  editableFinalAmount.value = total.value;
  isEditingFinalAmount.value = false;
  selectedCustomerId.value = null;
  customerSearchQuery.value = '';
  showConfirmModal.value = true;
};

// Select customer from search
const selectCustomer = (customer: Customer) => {
  selectedCustomerId.value = customer.id;
  customerSearchQuery.value = customer.name;
  isCustomerDropdownOpen.value = false;
};

// Clear customer selection
const clearCustomerSelection = () => {
  selectedCustomerId.value = null;
  customerSearchQuery.value = '';
};

// Toggle payment type
const setPaymentType = (type: 'immediate' | 'credit') => {
  paymentType.value = type;
  if (type === 'immediate') {
    // Immediate payment means full payment
    paidAmount.value = total.value;
    isEditingFinalAmount.value = false;
  } else {
    // Credit sale - reset to 0 paid by default
    paidAmount.value = 0;
    editableFinalAmount.value = total.value;
  }
};

// Enable editing final amount
const enableFinalAmountEdit = () => {
  editableFinalAmount.value = total.value;
  isEditingFinalAmount.value = true;
};

// Create new customer quickly
const createQuickCustomer = async () => {
  if (!newCustomerName.value.trim()) {
    showToast(t('sales.enter_customer_name'), 'warning');
    return;
  }
  
  try {
    const response = await $fetch('/api/customers', {
      method: 'POST',
      body: {
        name: newCustomerName.value,
        phone: newCustomerPhone.value || null,
      },
    });
    
    await refreshCustomers();
    selectedCustomerId.value = response.id;
    customerSearchQuery.value = newCustomerName.value;
    showNewCustomerForm.value = false;
    newCustomerName.value = '';
    newCustomerPhone.value = '';
    showToast(t('customers.customer_created'), 'success');
  } catch (error) {
    console.error('Failed to create customer:', error);
    showToast(t('customers.customer_create_error'), 'error');
  }
};

// Validate before confirming
const canConfirmSale = computed(() => {
  // Credit sales require a customer
  if (paymentType.value === 'credit' && !selectedCustomerId.value) {
    return false;
  }
  return true;
});

// Confirm sale with client info and payment
const confirmSale = async () => {
  // Validate credit sales require customer
  if (paymentType.value === 'credit' && !selectedCustomerId.value) {
    showToast(t('sales.credit_requires_customer'), 'error');
    return;
  }

  confirming.value = true;
  try {
    // Determine actual paid amount based on payment type
    const actualPaidAmount = paymentType.value === 'immediate' ? total.value : paidAmount.value;
    const actualFinalAmount = paymentType.value === 'credit' && isEditingFinalAmount.value 
      ? editableFinalAmount.value 
      : total.value;

    // Create draft sale first
    const draftResponse = await $fetch('/api/sales', {
      method: 'POST',
      body: {
        supplierId: selectedSupplierId.value || undefined,
        notes: notes.value || undefined,
        items: items.value.map(item => ({
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: item.unitCost,
          taxRate: item.taxRate || 0,
        })),
      },
    });

    // Now confirm the sale with client info and payment
    await $fetch(`/api/sales/${draftResponse.id}/confirm`, {
      method: 'POST',
      body: {
        clientName: clientName.value || selectedCustomer.value?.name || undefined,
        clientInfo: clientInfo.value || undefined,
        customerId: selectedCustomerId.value || undefined,
        paidAmount: actualPaidAmount,
        finalAmount: actualFinalAmount,
        paymentMethod: paymentMethod.value,
        paymentType: paymentType.value,
        dueDate: dueDate.value || undefined,
      },
    });

    showToast(
      paymentType.value === 'immediate' 
        ? t('sales.sale_confirmed_paid') 
        : t('sales.sale_confirmed_credit'),
      'success'
    );
    clearDraft();
    clientName.value = '';
    clientInfo.value = '';
    selectedCustomerId.value = null;
    customerSearchQuery.value = '';
    paidAmount.value = 0;
    dueDate.value = '';
    showConfirmModal.value = false;
    router.push('/sales');
  } catch (error: any) {
    console.error('Failed to confirm sale:', error);
    showToast(error.data?.message || t('sales.confirm_error'), 'error');
  } finally {
    confirming.value = false;
  }
};

// Handle clear draft
const handleClearDraft = () => {
  clearDraft();
  showClearConfirm.value = false;
  showToast(t('sales.draft_cleared'), 'success');
};

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.customer-search-container')) {
    isCustomerDropdownOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">{{ t('sales.current_draft') }}</h1>
        <p class="mt-1 text-sm text-gray-500">{{ t('sales.draft_description') }}</p>
      </div>
      <div class="flex items-center gap-3">
        <NuxtLink to="/stock/scan">
          <UiButton variant="outline">
            <Icon name="lucide:plus" class="h-4 w-4 mr-2" />
            {{ t('sales.add_items') }}
          </UiButton>
        </NuxtLink>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!items || items.length === 0" class="bg-white rounded-xl p-12 text-center">
      <Icon name="lucide:shopping-cart" class="h-16 w-16 text-gray-300 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">{{ t('sales.empty_draft') }}</h3>
      <p class="text-sm text-gray-500 mb-6">{{ t('sales.empty_draft_description') }}</p>
      <NuxtLink to="/stock/scan">
        <UiButton variant="primary">
          <Icon name="lucide:scan-barcode" class="h-4 w-4 mr-2" />
          {{ t('nav.scan') }}
        </UiButton>
      </NuxtLink>
    </div>

    <!-- Draft Content -->
    <div v-else-if="items && items.length > 0" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Items List -->
      <div class="lg:col-span-2 space-y-4">
        <div class="bg-white rounded-xl shadow-sm overflow-hidden">
          <div class="px-4 py-3 bg-gray-50 border-b">
            <h3 class="font-medium text-gray-900">
              {{ t('sales.sale_items') }} ({{ itemCount }})
            </h3>
          </div>
          <ul class="divide-y divide-gray-100">
            <li
              v-for="item in items"
              :key="item.id"
              class="p-4 hover:bg-gray-50"
            >
              <div class="flex items-start gap-4">
                <!-- Product Info -->
                <div class="flex-1 min-w-0">
                  <h4 class="font-medium text-gray-900 truncate">
                    {{ item.productName }}
                    <span v-if="item.variantName" class="text-gray-500 font-normal">
                      - {{ item.variantName }}
                    </span>
                  </h4>
                  <p class="text-sm text-gray-500">
                    SKU: {{ item.sku || '-' }}
                  </p>
                  <div class="flex items-center gap-1 mt-1">
                    <span class="text-sm text-gray-500">{{ t('products.price') }}:</span>
                    <input
                      type="number"
                      :value="item.unitPrice"
                      min="0"
                      step="0.01"
                      class="w-24 text-sm text-primary-600 font-medium border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      @change="updateItemPrice(item.productId, item.variantId || null, Number(($event.target as HTMLInputElement).value))"
                    />
                    <span class="text-sm text-gray-400">/ {{ t('products.unit') }}</span>
                  </div>
                </div>

                <!-- Quantity Controls -->
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
                    @click="updateQuantity(item.productId, item.variantId || null, item.quantity - 1)"
                  >
                    <Icon name="lucide:minus" class="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    :value="item.quantity"
                    min="1"
                    class="w-16 text-center border rounded-lg py-1.5 text-sm"
                    @change="updateQuantity(item.productId, item.variantId || null, Number(($event.target as HTMLInputElement).value))"
                  />
                  <button
                    type="button"
                    class="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
                    @click="updateQuantity(item.productId, item.variantId || null, item.quantity + 1)"
                  >
                    <Icon name="lucide:plus" class="h-4 w-4" />
                  </button>
                </div>

                <!-- Line Total -->
                <div class="text-right">
                  <p class="font-semibold text-gray-900">
                    {{ formatCurrency(item.lineTotal) }}
                  </p>
                </div>

                <!-- Remove Button -->
                <button
                  type="button"
                  class="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                  @click="removeItem(item.id)"
                >
                  <Icon name="lucide:trash-2" class="h-4 w-4" />
                </button>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <!-- Summary Panel -->
      <div class="space-y-4">
        <!-- Supplier Selection -->
        <div class="bg-white rounded-xl shadow-sm p-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            {{ t('suppliers.title') }} ({{ t('sales.optional') }})
          </label>
          <select
            v-model="selectedSupplierId"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option :value="null">{{ t('sales.no_supplier') }}</option>
            <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
              {{ supplier.name }}
            </option>
          </select>
        </div>

        <!-- Notes -->
        <div class="bg-white rounded-xl shadow-sm p-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            {{ t('app.notes') }}
          </label>
          <textarea
            v-model="notes"
            rows="3"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            :placeholder="t('sales.notes_placeholder')"
          />
        </div>

        <!-- Totals -->
        <div class="bg-white rounded-xl shadow-sm p-4">
          <h3 class="font-medium text-gray-900 mb-4">{{ t('sales.summary') }}</h3>
          <dl class="space-y-3">
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">{{ t('sales.subtotal') }}</dt>
              <dd class="text-sm font-medium text-gray-900">{{ formatCurrency(subtotal) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">{{ t('sales.tax') }}</dt>
              <dd class="text-sm font-medium text-gray-900">{{ formatCurrency(taxTotal) }}</dd>
            </div>
            <div class="flex justify-between pt-3 border-t">
              <dt class="text-base font-medium text-gray-900">{{ t('sales.total') }}</dt>
              <dd class="text-base font-bold text-primary-600">{{ formatCurrency(total) }}</dd>
            </div>
          </dl>
        </div>

        <!-- Actions -->
        <div class="space-y-3">
          <UiButton
            variant="primary"
            class="w-full"
            @click="openConfirmModal"
          >
            <Icon name="lucide:check" class="h-4 w-4 mr-2" />
            {{ t('sales.confirm_sale') }}
          </UiButton>
          <UiButton
            variant="outline"
            class="w-full text-red-600 hover:bg-red-50"
            @click="showClearConfirm = true"
          >
            <Icon name="lucide:trash" class="h-4 w-4 mr-2" />
            {{ t('sales.clear_draft') }}
          </UiButton>
        </div>
      </div>
    </div>

    <!-- Sale Confirmation Modal -->
    <UiModal
      :show="showConfirmModal"
      :title="t('sales.confirm_sale')"
      size="lg"
      @close="showConfirmModal = false"
    >
      <div class="space-y-5">
        <!-- Sale Summary -->
        <div class="bg-gray-50 rounded-lg p-4">
          <div class="flex justify-between mb-2">
            <span class="text-sm text-gray-500">{{ t('sales.sale_items') }}</span>
            <span class="text-sm font-medium">{{ itemCount }} {{ t('products.unit') }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm font-medium text-gray-900">{{ t('sales.total') }}</span>
            <span class="text-lg font-bold text-primary-600">{{ formatCurrency(total) }}</span>
          </div>
        </div>

        <!-- Payment Type Selection -->
        <div class="border rounded-lg overflow-hidden">
          <div class="grid grid-cols-2">
            <button
              type="button"
              :class="[
                'py-4 px-4 text-center transition-colors font-medium',
                paymentType === 'immediate' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              ]"
              @click="setPaymentType('immediate')"
            >
              <Icon name="lucide:banknote" class="h-5 w-5 mx-auto mb-1" />
              <div class="text-sm">{{ t('sales.immediate_payment') }}</div>
              <div class="text-xs opacity-75">{{ t('sales.immediate_payment_desc') }}</div>
            </button>
            <button
              type="button"
              :class="[
                'py-4 px-4 text-center transition-colors font-medium border-l',
                paymentType === 'credit' 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              ]"
              @click="setPaymentType('credit')"
            >
              <Icon name="lucide:clock" class="h-5 w-5 mx-auto mb-1" />
              <div class="text-sm">{{ t('sales.credit_sale') }}</div>
              <div class="text-xs opacity-75">{{ t('sales.credit_sale_desc') }}</div>
            </button>
          </div>
        </div>

        <!-- Immediate Payment Section -->
        <div v-if="paymentType === 'immediate'" class="bg-green-50 border border-green-200 rounded-lg p-4">
          <div class="flex items-center gap-2 text-green-700 mb-2">
            <Icon name="lucide:check-circle" class="h-5 w-5" />
            <span class="font-medium">{{ t('sales.full_payment_received') }}</span>
          </div>
          <p class="text-sm text-green-600">
            {{ t('sales.amount') }}: <strong>{{ formatCurrency(total) }}</strong>
          </p>
          
          <div class="mt-3">
            <label class="block text-sm text-green-700 mb-1">{{ t('sales.payment_method') }}</label>
            <select
              v-model="paymentMethod"
              class="w-full border border-green-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option v-for="method in paymentMethods" :key="method.value" :value="method.value">
                {{ method.label }}
              </option>
            </select>
          </div>

          <!-- Optional customer for immediate payment -->
          <div class="mt-3">
            <label class="block text-sm text-green-700 mb-1">
              {{ t('sales.customer') }} ({{ t('sales.optional') }})
            </label>
            <div class="customer-search-container relative">
              <input
                v-model="customerSearchQuery"
                type="text"
                :placeholder="t('sales.search_customer')"
                class="w-full border border-green-300 rounded-lg px-3 py-2 text-sm bg-white"
                @focus="isCustomerDropdownOpen = true"
                @input="isCustomerDropdownOpen = true"
              />
              <div 
                v-if="isCustomerDropdownOpen && filteredCustomers.length > 0"
                class="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto"
              >
                <button
                  v-for="customer in filteredCustomers"
                  :key="customer.id"
                  type="button"
                  class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex justify-between items-center"
                  @click="selectCustomer(customer)"
                >
                  <span>{{ customer.name }}</span>
                  <span class="text-gray-400 text-xs">{{ customer.phone || '' }}</span>
                </button>
              </div>
            </div>
            <div v-if="selectedCustomer" class="mt-2 flex items-center gap-2 text-sm text-green-600">
              <Icon name="lucide:user-check" class="h-4 w-4" />
              {{ selectedCustomer.name }}
              <button type="button" class="text-red-500 hover:text-red-600" @click="clearCustomerSelection">
                <Icon name="lucide:x" class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- Credit Sale Section -->
        <div v-if="paymentType === 'credit'" class="space-y-4">
          <!-- Customer Selection (Required) -->
          <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div class="flex items-center gap-2 text-orange-700 mb-3">
              <Icon name="lucide:user" class="h-5 w-5" />
              <span class="font-medium">{{ t('sales.select_customer_required') }}</span>
            </div>
            
            <div class="customer-search-container relative">
              <div class="flex gap-2">
                <div class="flex-1 relative">
                  <Icon name="lucide:search" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    v-model="customerSearchQuery"
                    type="text"
                    :placeholder="t('sales.search_customer_name_phone')"
                    class="w-full border border-orange-300 rounded-lg pl-9 pr-3 py-2 text-sm bg-white"
                    @focus="isCustomerDropdownOpen = true"
                    @input="isCustomerDropdownOpen = true"
                  />
                </div>
                <button
                  type="button"
                  class="px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                  @click="showNewCustomerForm = !showNewCustomerForm"
                >
                  <Icon name="lucide:user-plus" class="h-4 w-4" />
                </button>
              </div>
              
              <!-- Search Results Dropdown -->
              <div 
                v-if="isCustomerDropdownOpen && filteredCustomers.length > 0 && !selectedCustomerId"
                class="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto"
              >
                <button
                  v-for="customer in filteredCustomers"
                  :key="customer.id"
                  type="button"
                  class="w-full px-3 py-2 text-left text-sm hover:bg-orange-50 flex justify-between items-center border-b last:border-b-0"
                  @click="selectCustomer(customer)"
                >
                  <div>
                    <div class="font-medium">{{ customer.name }}</div>
                    <div class="text-xs text-gray-500">{{ customer.phone || customer.email || '' }}</div>
                  </div>
                  <div v-if="customer.currentBalance > 0" class="text-xs text-orange-600">
                    {{ t('credit.balance') }}: {{ formatCurrency(customer.currentBalance) }}
                  </div>
                </button>
              </div>
            </div>

            <!-- Selected Customer Display -->
            <div v-if="selectedCustomer" class="mt-3 bg-white rounded-lg p-3 border border-orange-200">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Icon name="lucide:user-check" class="h-5 w-5 text-green-500" />
                  <div>
                    <div class="font-medium text-gray-900">{{ selectedCustomer.name }}</div>
                    <div class="text-xs text-gray-500">{{ selectedCustomer.phone || selectedCustomer.email || '' }}</div>
                  </div>
                </div>
                <button type="button" class="text-gray-400 hover:text-red-500" @click="clearCustomerSelection">
                  <Icon name="lucide:x" class="h-5 w-5" />
                </button>
              </div>
              <div v-if="selectedCustomer.currentBalance > 0" class="mt-2 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                <Icon name="lucide:alert-circle" class="inline h-3 w-3 mr-1" />
                {{ t('sales.existing_balance') }}: {{ formatCurrency(selectedCustomer.currentBalance) }}
              </div>
            </div>

            <!-- Quick Add Customer Form -->
            <div v-if="showNewCustomerForm" class="mt-3 bg-white rounded-lg p-3 border border-orange-200 space-y-2">
              <div class="text-sm font-medium text-gray-700 mb-2">{{ t('sales.add_new_customer') }}</div>
              <input
                v-model="newCustomerName"
                type="text"
                :placeholder="t('credit.customer_name') + ' *'"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <div class="flex gap-2">
                <input
                  v-model="newCustomerPhone"
                  type="text"
                  :placeholder="t('credit.phone')"
                  class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  class="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                  @click="createQuickCustomer"
                >
                  {{ t('common.add') }}
                </button>
              </div>
            </div>

            <!-- Validation message -->
            <div v-if="!selectedCustomerId" class="mt-2 text-xs text-red-500">
              <Icon name="lucide:alert-triangle" class="inline h-3 w-3 mr-1" />
              {{ t('sales.credit_requires_customer') }}
            </div>
          </div>

          <!-- Editable Final Amount (for discounts) -->
          <div class="bg-white border rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <span class="font-medium text-gray-700">{{ t('sales.final_amount') }}</span>
              <button
                v-if="!isEditingFinalAmount"
                type="button"
                class="text-sm text-blue-600 hover:text-blue-700"
                @click="enableFinalAmountEdit"
              >
                <Icon name="lucide:edit-2" class="inline h-3 w-3 mr-1" />
                {{ t('sales.edit_for_discount') }}
              </button>
            </div>
            
            <div v-if="isEditingFinalAmount" class="space-y-2">
              <input
                v-model.number="editableFinalAmount"
                type="number"
                step="0.01"
                min="0"
                :max="total"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg font-bold text-center"
              />
              <div v-if="editableFinalAmount < total" class="text-xs text-green-600 text-center">
                {{ t('sales.discount_applied') }}: {{ formatCurrency(total - editableFinalAmount) }}
              </div>
            </div>
            <div v-else class="text-2xl font-bold text-center text-gray-900">
              {{ formatCurrency(total) }}
            </div>
          </div>

          <!-- Partial Payment Option -->
          <div class="bg-white border rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <span class="font-medium text-gray-700">{{ t('sales.advance_payment') }}</span>
              <span class="text-xs text-gray-500">{{ t('sales.optional') }}</span>
            </div>
            
            <div class="flex gap-2">
              <input
                v-model.number="paidAmount"
                type="number"
                step="0.01"
                min="0"
                :max="finalAmount"
                :placeholder="t('sales.enter_amount')"
                class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <select
                v-model="paymentMethod"
                class="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option v-for="method in paymentMethods" :key="method.value" :value="method.value">
                  {{ method.label }}
                </option>
              </select>
            </div>
          </div>

          <!-- Outstanding Balance Summary -->
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm text-red-700 font-medium">{{ t('sales.outstanding_balance') }}</span>
                <p class="text-xs text-red-600">{{ t('sales.to_be_paid_later') }}</p>
              </div>
              <span class="text-xl font-bold text-red-600">{{ formatCurrency(outstandingBalance) }}</span>
            </div>
          </div>

          <!-- Due Date -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ t('sales.due_date') }} ({{ t('sales.optional') }})
            </label>
            <input
              v-model="dueDate"
              type="date"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <!-- Client Info Section (legacy, for walk-in immediate sales only) -->
        <div v-if="paymentType === 'immediate' && !selectedCustomerId" class="border-t pt-4">
          <h4 class="text-sm font-medium text-gray-700 mb-3">
            {{ t('sales.client_info') }} ({{ t('sales.optional') }})
          </h4>
          
          <div class="space-y-3">
            <div>
              <label class="block text-sm text-gray-600 mb-1">
                {{ t('sales.client_name') }}
              </label>
              <input
                v-model="clientName"
                type="text"
                :placeholder="t('sales.client_name_placeholder')"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <div>
              <label class="block text-sm text-gray-600 mb-1">
                {{ t('sales.client_details') }}
              </label>
              <textarea
                v-model="clientInfo"
                rows="2"
                :placeholder="t('sales.client_details_placeholder')"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UiButton variant="outline" @click="showConfirmModal = false">
            {{ t('app.cancel') }}
          </UiButton>
          <UiButton 
            :variant="paymentType === 'immediate' ? 'primary' : 'warning'"
            :loading="confirming"
            :disabled="!canConfirmSale"
            @click="confirmSale"
          >
            <Icon :name="paymentType === 'immediate' ? 'lucide:check' : 'lucide:clock'" class="h-4 w-4 mr-2" />
            {{ paymentType === 'immediate' ? t('sales.confirm_paid') : t('sales.confirm_credit') }}
          </UiButton>
        </div>
      </template>
    </UiModal>

    <!-- Clear Confirmation Modal -->
    <UiModal
      :show="showClearConfirm"
      :title="t('sales.clear_draft')"
      @close="showClearConfirm = false"
    >
      <p class="text-gray-600 mb-6">{{ t('sales.clear_confirm') }}</p>
      <div class="flex justify-end gap-3">
        <UiButton variant="outline" @click="showClearConfirm = false">
          {{ t('app.cancel') }}
        </UiButton>
        <UiButton variant="danger" @click="handleClearDraft">
          {{ t('sales.clear_draft') }}
        </UiButton>
      </div>
    </UiModal>
  </div>
</template>
