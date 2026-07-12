<script setup lang="ts">
definePageMeta({
  layout: 'admin',
});

const { t, locale } = useI18n();
const toast = useToast();

// Helper function to add toast (compatible with old code)
const addToast = (options: { title: string; message?: string; type: 'success' | 'error' | 'warning' | 'info' }) => {
  toast.add({
    title: options.title,
    description: options.message,
    type: options.type,
  });
};

// Scanner composable
const scanner = useScanner({
  onCode: handleBarcodeScan,
});

// Sale draft composable
const saleDraft = useSaleDraft();

// State
const searchQuery = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);
const isSearching = ref(false);
const searchResults = ref<any[]>([]);
const selectedProduct = ref<any>(null);
const selectedVariant = ref<any>(null);
const quantity = ref(1);
const selectedResultIndex = ref(-1);
const showCameraScanner = ref(false);

// Checkout modal state
const showCheckoutModal = ref(false);
const isConfirming = ref(false);
const clientName = ref('');
const clientInfo = ref('');
const confirmedSale = ref<any>(null);
const showReceiptModal = ref(false);

// Payment & Customer state for checkout
const paymentType = ref<'immediate' | 'credit'>('immediate');
const customerSearchQuery = ref('');
const selectedCustomerId = ref<string | null>(null);
const isCustomerDropdownOpen = ref(false);
const paidAmount = ref(0);
const paymentMethod = ref('cash');
const dueDate = ref('');
const showNewCustomerForm = ref(false);
const newCustomerName = ref('');
const newCustomerPhone = ref('');
const editableFinalAmount = ref(0);
const isEditingFinalAmount = ref(false);

// Fetch customers
const { data: customersData, refresh: refreshCustomers } = await useFetch('/api/customers');
const customers = computed(() => customersData.value || []);

// Filtered customers based on search
const filteredCustomers = computed(() => {
  if (!customerSearchQuery.value.trim()) {
    return customers.value || [];
  }
  const query = customerSearchQuery.value.toLowerCase();
  return (customers.value || []).filter((c: any) => 
    c.name.toLowerCase().includes(query) ||
    (c.phone && c.phone.includes(query)) ||
    (c.email && c.email.toLowerCase().includes(query))
  );
});

// Selected customer
const selectedCustomer = computed(() => 
  customers.value.find((c: any) => c.id === selectedCustomerId.value)
);

// Final amount (can be edited for discounts)
const finalAmount = computed(() => {
  if (paymentType.value === 'credit' && isEditingFinalAmount.value) {
    return editableFinalAmount.value;
  }
  return saleDraft.total.value;
});

// Outstanding balance for credit sales
const outstandingBalance = computed(() => {
  if (paymentType.value === 'immediate') return 0;
  return Math.max(0, finalAmount.value - paidAmount.value);
});

// Can confirm sale
const canConfirmSale = computed(() => {
  if (paymentType.value === 'credit' && !selectedCustomerId.value) {
    return false;
  }
  return !saleDraft.isEmpty.value;
});

// Payment methods
const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile', label: 'Mobile Payment' },
  { value: 'check', label: 'Check' },
];

// Select customer from search
const selectCustomer = (customer: any) => {
  selectedCustomerId.value = customer.id;
  customerSearchQuery.value = customer.name;
  isCustomerDropdownOpen.value = false;
};

// Clear customer selection
const clearCustomerSelection = () => {
  selectedCustomerId.value = null;
  customerSearchQuery.value = '';
};

// Set payment type
const setPaymentType = (type: 'immediate' | 'credit') => {
  paymentType.value = type;
  if (type === 'immediate') {
    paidAmount.value = saleDraft.total.value;
    isEditingFinalAmount.value = false;
  } else {
    paidAmount.value = 0;
    editableFinalAmount.value = saleDraft.total.value;
  }
};

// Enable final amount editing
const enableFinalAmountEdit = () => {
  editableFinalAmount.value = saleDraft.total.value;
  isEditingFinalAmount.value = true;
};

// Create quick customer
const createQuickCustomer = async () => {
  if (!newCustomerName.value.trim()) {
    addToast({ title: t('sales.enter_customer_name'), type: 'warning' });
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
    selectedCustomerId.value = (response as any).id;
    customerSearchQuery.value = newCustomerName.value;
    showNewCustomerForm.value = false;
    newCustomerName.value = '';
    newCustomerPhone.value = '';
    addToast({ title: t('customers.customer_created'), type: 'success' });
  } catch (error) {
    console.error('Failed to create customer:', error);
    addToast({ title: t('customers.customer_create_error'), type: 'error' });
  }
};

// Variant selection modal state
const showVariantModal = ref(false);
const pendingProduct = ref<any>(null);

// Stock operation mode
type OperationMode = 'sale' | 'stock_in' | 'stock_out';
const operationMode = ref<OperationMode>('sale');

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

const performSearch = async (query: string) => {
  if (!query || query.length < 2) {
    searchResults.value = [];
    return;
  }

  isSearching.value = true;
  try {
    const results = await $fetch('/api/products/search', {
      query: { q: query, limit: 10 },
    });
    searchResults.value = results as any[];
  } catch (error) {
    console.error('Search failed:', error);
    searchResults.value = [];
  } finally {
    isSearching.value = false;
  }
};

const debouncedSearch = (query: string) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => performSearch(query), 100);
};

watch(searchQuery, (value) => {
  selectedResultIndex.value = -1;
  debouncedSearch(value);
});

// Handle barcode scan
async function handleBarcodeScan(code: string) {
  searchQuery.value = code;
  
  try {
    const results = await $fetch('/api/products/search', {
      query: { barcode: code },
    });
    
    if (Array.isArray(results) && results.length > 0) {
      const product = results[0] as any;
      
      // Auto-add to cart in sale mode
      if (operationMode.value === 'sale') {
        quickAddToCart(product, product.matchedVariant);
      } else {
        selectProduct(product, product.matchedVariant);
      }
    } else {
      addToast({
        title: t('stock.no_results'),
        message: `${t('products.barcode')}: ${code}`,
        type: 'warning',
      });
    }
  } catch (error) {
    console.error('Barcode search failed:', error);
  }
  
  searchQuery.value = '';
  focusSearchInput();
}

// Quick add to cart without selection
function quickAddToCart(product: any, variant?: any) {
  const price = variant?.price ?? product.sellingPrice ?? 0;
  const cost = variant?.costPrice ?? product.costPrice ?? 0;
  
  saleDraft.addItem({
    productId: product.id,
    variantId: variant?.id,
    productName: product.name,
    variantName: variant?.name,
    sku: variant?.sku ?? product.sku,
    quantity: 1,
    unitPrice: price,
    unitCost: cost,
    taxRate: 0, // No automatic tax - tax can be added manually if needed
  });
  
  addToast({
    title: t('stock.added_to_cart'),
    message: product.name + (variant ? ` - ${variant.name}` : ''),
    type: 'success',
  });
}

// Select product from search results
function selectProduct(product: any, variant?: any) {
  selectedProduct.value = product;
  selectedVariant.value = variant || null;
  quantity.value = 1;
  searchResults.value = [];
  searchQuery.value = '';
}

// Handle product click - different behavior based on mode
function handleProductClick(product: any, variant?: any) {
  if (operationMode.value === 'sale') {
    // In sale mode, check if product has variants but no variant selected
    if (product.variants && product.variants.length > 0 && !variant) {
      // Show variant selection modal
      pendingProduct.value = product;
      showVariantModal.value = true;
      searchResults.value = [];
      searchQuery.value = '';
    } else {
      // Add directly to cart
      quickAddToCart(product, variant);
      searchResults.value = [];
      searchQuery.value = '';
    }
  } else {
    // In stock mode, select for quantity input
    selectProduct(product, variant);
  }
}

// Handle variant selection from modal
function selectVariantForSale(variant: any) {
  if (pendingProduct.value) {
    quickAddToCart(pendingProduct.value, variant);
    showVariantModal.value = false;
    pendingProduct.value = null;
  }
}

// Close variant modal
function closeVariantModal() {
  showVariantModal.value = false;
  pendingProduct.value = null;
}

// Clear selection
function clearSelection() {
  selectedProduct.value = null;
  selectedVariant.value = null;
  quantity.value = 1;
  focusSearchInput();
}

// Focus search input
function focusSearchInput() {
  nextTick(() => {
    searchInputRef.value?.focus();
  });
}

// Keyboard navigation
function handleKeydown(event: KeyboardEvent) {
  // Handle HID scanner input
  scanner.handleHidInput(event);
  
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (selectedResultIndex.value < searchResults.value.length - 1) {
      selectedResultIndex.value++;
    }
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (selectedResultIndex.value > 0) {
      selectedResultIndex.value--;
    }
  } else if (event.key === 'Enter') {
    if (selectedResultIndex.value >= 0 && searchResults.value[selectedResultIndex.value]) {
      event.preventDefault();
      const product = searchResults.value[selectedResultIndex.value];
      handleProductClick(product, product.matchedVariant);
    }
  } else if (event.key === 'Escape') {
    if (selectedProduct.value) {
      clearSelection();
    } else {
      searchQuery.value = '';
      searchResults.value = [];
    }
  }
}

// Add selected product to cart
function addSelectedToCart() {
  if (!selectedProduct.value || quantity.value <= 0) return;
  
  const price = selectedVariant.value?.price ?? selectedProduct.value.sellingPrice ?? 0;
  const cost = selectedVariant.value?.costPrice ?? selectedProduct.value.costPrice ?? 0;
  const taxRate = selectedProduct.value.tax?.rate ?? 0;
  
  saleDraft.addItem({
    productId: selectedProduct.value.id,
    variantId: selectedVariant.value?.id,
    productName: selectedProduct.value.name,
    variantName: selectedVariant.value?.name,
    sku: selectedVariant.value?.sku ?? selectedProduct.value.sku,
    quantity: quantity.value,
    unitPrice: price,
    unitCost: cost,
    taxRate,
  });
  
  addToast({
    title: t('stock.added_to_cart'),
    message: `${quantity.value}x ${selectedProduct.value.name}`,
    type: 'success',
  });
  
  clearSelection();
}

// Stock operations
async function handleStockIn() {
  if (!selectedProduct.value || quantity.value <= 0) return;
  
  try {
    await $fetch('/api/movements', {
      method: 'POST',
      body: {
        productId: selectedProduct.value.id,
        variantId: selectedVariant.value?.id,
        type: 'in',
        quantity: quantity.value,
        reason: t('stock.stock_in'),
      },
    });
    
    addToast({
      title: t('stock.operation_success'),
      message: `+${quantity.value} ${selectedProduct.value.name}`,
      type: 'success',
    });
    
    clearSelection();
  } catch (error: any) {
    addToast({
      title: t('stock.operation_failed'),
      message: error.message || t('errors.server_error'),
      type: 'error',
    });
  }
}

async function handleStockOut() {
  if (!selectedProduct.value || quantity.value <= 0) return;
  
  const currentStock = selectedVariant.value?.stockQuantity ?? selectedProduct.value.stockQuantity ?? 0;
  
  if (quantity.value > currentStock) {
    addToast({
      title: t('errors.insufficient_stock'),
      message: `${t('products.stock')}: ${currentStock}`,
      type: 'error',
    });
    return;
  }
  
  try {
    await $fetch('/api/movements', {
      method: 'POST',
      body: {
        productId: selectedProduct.value.id,
        variantId: selectedVariant.value?.id,
        type: 'out',
        quantity: quantity.value,
        reason: t('stock.stock_out'),
      },
    });
    
    addToast({
      title: t('stock.operation_success'),
      message: `-${quantity.value} ${selectedProduct.value.name}`,
      type: 'success',
    });
    
    clearSelection();
  } catch (error: any) {
    addToast({
      title: t('stock.operation_failed'),
      message: error.message || t('errors.server_error'),
      type: 'error',
    });
  }
}

// Checkout functions
function openCheckout() {
  if (saleDraft.isEmpty.value) return;
  // Reset state
  paymentType.value = 'immediate';
  paidAmount.value = saleDraft.total.value;
  editableFinalAmount.value = saleDraft.total.value;
  isEditingFinalAmount.value = false;
  selectedCustomerId.value = null;
  customerSearchQuery.value = '';
  showNewCustomerForm.value = false;
  showCheckoutModal.value = true;
}

async function confirmSale() {
  if (saleDraft.isEmpty.value) return;
  
  // Validate credit sales require customer
  if (paymentType.value === 'credit' && !selectedCustomerId.value) {
    addToast({ title: t('sales.credit_requires_customer'), type: 'error' });
    return;
  }
  
  isConfirming.value = true;
  try {
    // Determine amounts
    const actualPaidAmount = paymentType.value === 'immediate' ? saleDraft.total.value : paidAmount.value;
    const actualFinalAmount = paymentType.value === 'credit' && isEditingFinalAmount.value 
      ? editableFinalAmount.value 
      : saleDraft.total.value;

    // First create the sale
    const sale = await saleDraft.createSale();
    
    // Then confirm it with payment info
    const confirmed = await $fetch(`/api/sales/${(sale as any).id}/confirm`, {
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
    
    confirmedSale.value = confirmed;
    saleDraft.clearDraft();
    
    showCheckoutModal.value = false;
    showReceiptModal.value = true;
    
    // Reset state
    clientName.value = '';
    clientInfo.value = '';
    selectedCustomerId.value = null;
    customerSearchQuery.value = '';
    paidAmount.value = 0;
    dueDate.value = '';
    
    addToast({
      title: paymentType.value === 'immediate' ? t('sales.sale_confirmed_paid') : t('sales.sale_confirmed_credit'),
      message: t('sales.sale_success'),
      type: 'success',
    });
  } catch (error: any) {
    console.error('Sale confirmation error:', error);
    if (error.data?.items) {
      // Insufficient stock error
      addToast({
        title: t('errors.insufficient_stock'),
        message: error.data.items.map((i: any) => 
          `${i.productName}: ${i.available}/${i.requested}`
        ).join(', '),
        type: 'error',
      });
    } else {
      addToast({
        title: t('errors.server_error'),
        message: error.data?.message || error.message || t('sales.sale_failed'),
        type: 'error',
      });
    }
  } finally {
    isConfirming.value = false;
  }
}

function closeReceipt() {
  showReceiptModal.value = false;
  confirmedSale.value = null;
  focusSearchInput();
}

function printReceipt() {
  window.print();
}

// Format currency
const formatCurrency = (value: number) => {
  const currency = 'DZD';
  if (currency === 'DZD') {
    return new Intl.NumberFormat(locale.value === 'ar' ? 'ar-DZ' : 'fr-DZ', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + ' DA';
  }
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency,
  }).format(value);
};

// Format date
const formatDate = (date: string | Date) => {
  return new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-DZ' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

// Global hotkey for focus
onMounted(() => {
  focusSearchInput();
  
  const handleGlobalKeydown = (event: KeyboardEvent) => {
    if (event.key === '/' && document.activeElement !== searchInputRef.value) {
      event.preventDefault();
      focusSearchInput();
    }
    // F2 to open checkout
    if (event.key === 'F2' && !saleDraft.isEmpty.value) {
      event.preventDefault();
      openCheckout();
    }
  };
  
  document.addEventListener('keydown', handleGlobalKeydown);
  
  onUnmounted(() => {
    document.removeEventListener('keydown', handleGlobalKeydown);
  });
});
</script>

<template>
  <div class="h-[calc(100vh-7rem)] flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">
          {{ t('stock.scan_and_sell') }}
        </h1>
        <p class="mt-1 text-sm text-gray-500">
          {{ t('stock.scan_sell_description') }}
        </p>
      </div>
      
      <div class="flex items-center gap-3">
        <!-- Mode Toggle -->
        <div class="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            @click="operationMode = 'sale'"
            class="px-4 py-2 text-sm font-medium rounded-md transition-all"
            :class="operationMode === 'sale' 
              ? 'bg-white text-primary-700 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'"
          >
            <Icon name="lucide:shopping-cart" class="h-4 w-4 ltr:mr-2 rtl:ml-2 inline" />
            {{ t('stock.mode_sale') }}
          </button>
          <button
            @click="operationMode = 'stock_in'"
            class="px-4 py-2 text-sm font-medium rounded-md transition-all"
            :class="operationMode === 'stock_in' 
              ? 'bg-white text-green-700 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'"
          >
            <Icon name="lucide:plus-circle" class="h-4 w-4 ltr:mr-2 rtl:ml-2 inline" />
            {{ t('stock.stock_in') }}
          </button>
          <button
            @click="operationMode = 'stock_out'"
            class="px-4 py-2 text-sm font-medium rounded-md transition-all"
            :class="operationMode === 'stock_out' 
              ? 'bg-white text-red-700 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'"
          >
            <Icon name="lucide:minus-circle" class="h-4 w-4 ltr:mr-2 rtl:ml-2 inline" />
            {{ t('stock.stock_out') }}
          </button>
        </div>

        <UiButton
          v-if="scanner.isSupported"
          variant="outline"
          size="sm"
          @click="showCameraScanner = !showCameraScanner"
        >
          <Icon name="lucide:camera" class="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {{ showCameraScanner ? t('app.close') : t('stock.camera') }}
        </UiButton>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
      <!-- Left Column: Search & Results -->
      <div class="lg:col-span-2 flex flex-col min-h-0">
        <!-- Search Input -->
        <div class="relative mb-4">
          <div class="absolute inset-y-0 ltr:left-0 rtl:right-0 ltr:pl-4 rtl:pr-4 flex items-center pointer-events-none">
            <Icon name="lucide:search" class="h-5 w-5 text-gray-400" />
          </div>
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            :placeholder="t('stock.search_placeholder')"
            class="block w-full ltr:pl-11 rtl:pr-11 ltr:pr-4 rtl:pl-4 py-4 text-lg border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            @keydown="handleKeydown"
          />
          <div v-if="isSearching" class="absolute inset-y-0 ltr:right-0 rtl:left-0 ltr:pr-4 rtl:pl-4 flex items-center">
            <Icon name="lucide:loader-2" class="h-5 w-5 text-gray-400 animate-spin" />
          </div>
          <div v-else class="absolute inset-y-0 ltr:right-0 rtl:left-0 ltr:pr-4 rtl:pl-4 flex items-center text-gray-400 text-sm">
            <kbd class="px-2 py-1 bg-gray-100 rounded text-xs font-mono">/</kbd>
          </div>
        </div>

        <!-- Search Results -->
        <div
          v-if="searchResults.length > 0"
          class="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden mb-4"
        >
          <div
            v-for="(product, index) in searchResults"
            :key="product.id"
            class="flex items-center gap-4 p-4 cursor-pointer transition-colors"
            :class="[
              index === selectedResultIndex ? 'bg-primary-50' : 'hover:bg-gray-50',
              index !== 0 ? 'border-t border-gray-100' : '',
            ]"
            @click="handleProductClick(product, product.matchedVariant)"
          >
            <div class="flex-1 min-w-0">
              <p class="font-medium text-gray-900 truncate">{{ product.name }}</p>
              <div class="flex items-center gap-2 text-sm text-gray-500">
                <span v-if="product.sku">{{ product.sku }}</span>
                <span v-if="product.barcode" class="text-xs bg-gray-100 px-2 py-0.5 rounded">
                  {{ product.barcode }}
                </span>
                <span v-if="product.matchedVariant" class="text-primary-600">
                  • {{ product.matchedVariant.name }}
                </span>
              </div>
            </div>
            <div class="text-right">
              <p class="font-medium text-gray-900">
                {{ formatCurrency(product.matchedVariant?.price || product.sellingPrice || 0) }}
              </p>
              <p
                class="text-sm"
                :class="[
                  (product.stockQuantity || 0) <= (product.stockMin || 0)
                    ? 'text-red-600'
                    : 'text-gray-500',
                ]"
              >
                {{ t('products.stock') }}: {{ product.matchedVariant?.stockQuantity ?? product.stockQuantity ?? 0 }}
              </p>
            </div>
          </div>
        </div>

        <!-- Selected Product Card (for stock operations) -->
        <div
          v-if="selectedProduct && operationMode !== 'sale'"
          class="bg-white border border-gray-200 rounded-xl p-6 space-y-4 mb-4"
        >
          <div class="flex items-start justify-between">
            <div>
              <h3 class="font-semibold text-gray-900 text-lg">
                {{ selectedProduct.name }}
              </h3>
              <p v-if="selectedVariant" class="text-primary-600">
                {{ selectedVariant.name }}
              </p>
              <p class="text-sm text-gray-500 mt-1">
                {{ selectedVariant?.sku || selectedProduct.sku || '-' }}
              </p>
            </div>
            <button
              @click="clearSelection"
              class="text-gray-400 hover:text-gray-600"
            >
              <Icon name="lucide:x" class="h-5 w-5" />
            </button>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-gray-500 uppercase">{{ t('products.selling_price') }}</p>
              <p class="text-lg font-semibold text-gray-900">
                {{ formatCurrency(selectedVariant?.price || selectedProduct.sellingPrice || 0) }}
              </p>
            </div>
            <div>
              <p class="text-xs text-gray-500 uppercase">{{ t('products.stock') }}</p>
              <p
                class="text-lg font-semibold"
                :class="[
                  (selectedVariant?.stockQuantity ?? selectedProduct.stockQuantity ?? 0) <= 
                  (selectedProduct.stockMin || 0)
                    ? 'text-red-600'
                    : 'text-gray-900',
                ]"
              >
                {{ selectedVariant?.stockQuantity ?? selectedProduct.stockQuantity ?? 0 }}
              </p>
            </div>
          </div>

          <!-- Variant Selector -->
          <div v-if="selectedProduct.variants?.length > 0 && !selectedVariant">
            <p class="text-xs text-gray-500 uppercase mb-2">{{ t('products.variants') }}</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="variant in selectedProduct.variants"
                :key="variant.id"
                @click="selectedVariant = variant"
                class="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
              >
                {{ variant.name }}
              </button>
            </div>
          </div>

          <!-- Quantity Input -->
          <div>
            <label class="text-xs text-gray-500 uppercase">{{ t('stock.quantity') }}</label>
            <div class="flex items-center gap-2 mt-1">
              <button
                @click="quantity = Math.max(1, quantity - 1)"
                class="w-10 h-10 flex items-center justify-center border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <Icon name="lucide:minus" class="h-4 w-4" />
              </button>
              <input
                v-model.number="quantity"
                type="number"
                min="1"
                class="flex-1 text-center text-lg font-medium border border-gray-200 rounded-lg py-2"
              />
              <button
                @click="quantity++"
                class="w-10 h-10 flex items-center justify-center border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <Icon name="lucide:plus" class="h-4 w-4" />
              </button>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="grid grid-cols-2 gap-3 pt-2">
            <UiButton
              v-if="operationMode === 'stock_in'"
              variant="primary"
              class="!bg-green-600 hover:!bg-green-700 col-span-2"
              @click="handleStockIn"
            >
              <Icon name="lucide:plus-circle" class="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {{ t('stock.stock_in') }} (+{{ quantity }})
            </UiButton>
            <UiButton
              v-if="operationMode === 'stock_out'"
              variant="primary"
              class="!bg-red-600 hover:!bg-red-700 col-span-2"
              @click="handleStockOut"
            >
              <Icon name="lucide:minus-circle" class="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {{ t('stock.stock_out') }} (-{{ quantity }})
            </UiButton>
          </div>
        </div>

        <!-- Camera Scanner -->
        <div
          v-if="showCameraScanner"
          class="bg-gray-900 rounded-xl overflow-hidden aspect-video relative flex-shrink-0"
        >
          <video
            ref="videoRef"
            class="w-full h-full object-cover"
            autoplay
            playsinline
          />
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="w-64 h-32 border-2 border-white/50 rounded-lg" />
          </div>
          <p class="absolute bottom-4 left-0 right-0 text-center text-white text-sm">
            {{ t('stock.scanning') }}
          </p>
        </div>

        <!-- Empty state when no results and no selection -->
        <div
          v-if="searchResults.length === 0 && !selectedProduct && !showCameraScanner && operationMode === 'sale'"
          class="flex-1 flex items-center justify-center bg-white border border-gray-200 rounded-xl"
        >
          <div class="text-center p-8">
            <Icon name="lucide:scan-barcode" class="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p class="text-gray-500 text-lg">{{ t('stock.scan_or_search') }}</p>
            <p class="text-sm text-gray-400 mt-2">{{ t('stock.auto_add_hint') }}</p>
          </div>
        </div>
      </div>

      <!-- Right Column: Cart -->
      <div class="flex flex-col min-h-0 bg-white border border-gray-200 rounded-xl overflow-hidden">
        <!-- Cart Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
          <div class="flex items-center gap-2">
            <Icon name="lucide:shopping-cart" class="h-5 w-5 text-primary-600" />
            <h3 class="font-semibold text-gray-900">{{ t('sales.cart') }}</h3>
            <span
              v-if="saleDraft.itemCount.value > 0"
              class="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full"
            >
              {{ saleDraft.itemCount.value }}
            </span>
          </div>
          <button
            v-if="!saleDraft.isEmpty.value"
            @click="saleDraft.clearDraft"
            class="text-gray-400 hover:text-red-600 transition-colors"
            :title="t('sales.clear_cart')"
          >
            <Icon name="lucide:trash-2" class="h-4 w-4" />
          </button>
        </div>

        <!-- Cart Items -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          <template v-if="saleDraft.isEmpty.value">
            <div class="flex flex-col items-center justify-center h-full text-center py-8">
              <Icon name="lucide:shopping-bag" class="h-12 w-12 text-gray-200 mb-3" />
              <p class="text-gray-400">{{ t('sales.cart_empty') }}</p>
              <p class="text-xs text-gray-300 mt-1">{{ t('sales.scan_to_add') }}</p>
            </div>
          </template>
          
          <div
            v-for="item in saleDraft.items.value"
            :key="item.id"
            class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
          >
            <div class="flex-1 min-w-0">
              <p class="font-medium text-gray-900 text-sm truncate">
                {{ item.productName }}
              </p>
              <p v-if="item.variantName" class="text-xs text-gray-500">
                {{ item.variantName }}
              </p>
              <p class="text-sm text-primary-600 font-medium mt-1">
                {{ formatCurrency(item.unitPrice) }}
              </p>
            </div>
            
            <!-- Quantity controls -->
            <div class="flex items-center gap-1">
              <button
                @click="saleDraft.updateItemQuantity(item.id, item.quantity - 1)"
                class="w-7 h-7 flex items-center justify-center border border-gray-200 rounded bg-white hover:bg-gray-50 text-gray-600"
              >
                <Icon name="lucide:minus" class="h-3 w-3" />
              </button>
              <span class="w-8 text-center text-sm font-medium">{{ item.quantity }}</span>
              <button
                @click="saleDraft.updateItemQuantity(item.id, item.quantity + 1)"
                class="w-7 h-7 flex items-center justify-center border border-gray-200 rounded bg-white hover:bg-gray-50 text-gray-600"
              >
                <Icon name="lucide:plus" class="h-3 w-3" />
              </button>
            </div>

            <!-- Line total -->
            <div class="text-right">
              <p class="font-semibold text-gray-900 text-sm">
                {{ formatCurrency(item.lineTotal) }}
              </p>
              <button
                @click="saleDraft.removeItem(item.id)"
                class="text-xs text-red-500 hover:text-red-700 mt-1"
              >
                {{ t('app.delete') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Cart Footer -->
        <div class="border-t border-gray-100 p-4 space-y-3 bg-gray-50">
          <!-- Totals -->
          <div class="space-y-2 text-sm">
            <div class="flex items-center justify-between text-gray-600">
              <span>{{ t('sales.subtotal') }}</span>
              <span>{{ formatCurrency(saleDraft.subtotal.value) }}</span>
            </div>
            <div class="flex items-center justify-between text-gray-600">
              <span>{{ t('sales.tax') }}</span>
              <span>{{ formatCurrency(saleDraft.taxTotal.value) }}</span>
            </div>
            <div class="flex items-center justify-between font-bold text-lg text-gray-900 pt-2 border-t border-gray-200">
              <span>{{ t('sales.total') }}</span>
              <span class="text-primary-600">{{ formatCurrency(saleDraft.total.value) }}</span>
            </div>
          </div>

          <!-- Checkout Button -->
          <UiButton
            variant="primary"
            block
            size="lg"
            :disabled="saleDraft.isEmpty.value"
            @click="openCheckout"
          >
            <Icon name="lucide:check-circle" class="h-5 w-5 ltr:mr-2 rtl:ml-2" />
            {{ t('sales.confirm_sale') }}
            <span class="text-xs opacity-75 ltr:ml-2 rtl:mr-2">(F2)</span>
          </UiButton>
        </div>
      </div>
    </div>

    <!-- Checkout Modal -->
    <UiModal
      :show="showCheckoutModal"
      :title="t('sales.checkout')"
      size="lg"
      @close="showCheckoutModal = false"
    >
      <div class="space-y-5">
        <!-- Order Summary with Editable Prices -->
        <div class="bg-gray-50 rounded-lg p-4">
          <h4 class="font-medium text-gray-900 mb-3">{{ t('sales.order_summary') }}</h4>
          <div class="space-y-2 max-h-48 overflow-y-auto">
            <div
              v-for="item in saleDraft.items.value"
              :key="item.id"
              class="flex items-center justify-between text-sm py-1"
            >
              <span class="text-gray-700 flex-1">
                {{ item.quantity }}x {{ item.productName }}
                <span v-if="item.variantName" class="text-gray-500">({{ item.variantName }})</span>
              </span>
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  :value="item.unitPrice"
                  min="0"
                  step="0.01"
                  class="w-24 text-right text-sm border border-gray-200 rounded px-2 py-1"
                  @change="saleDraft.updateItemPrice(item.productId, item.variantId || null, Number(($event.target as HTMLInputElement).value))"
                />
                <span class="font-medium w-28 text-right">{{ formatCurrency(item.lineTotal) }}</span>
              </div>
            </div>
          </div>
          <div class="border-t border-gray-200 mt-3 pt-3 flex items-center justify-between font-bold">
            <span>{{ t('sales.total') }}</span>
            <span class="text-lg text-primary-600">{{ formatCurrency(saleDraft.total.value) }}</span>
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
            {{ t('sales.amount') }}: <strong>{{ formatCurrency(saleDraft.total.value) }}</strong>
          </p>
          
          <div class="mt-3">
            <label class="block text-sm text-green-700 mb-1">{{ t('sales.payment_method') }}</label>
            <select v-model="paymentMethod" class="w-full border border-green-300 rounded-lg px-3 py-2 text-sm bg-white">
              <option v-for="method in paymentMethods" :key="method.value" :value="method.value">
                {{ method.label }}
              </option>
            </select>
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
            
            <div class="relative">
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
              
              <!-- Click outside backdrop to close dropdown -->
              <div 
                v-if="isCustomerDropdownOpen && filteredCustomers.length > 0 && !selectedCustomerId"
                class="fixed inset-0 z-[5]"
                @click="isCustomerDropdownOpen = false"
              />
              
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
                    <div class="text-xs text-gray-500">{{ selectedCustomer.phone || '' }}</div>
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

          <!-- Editable Final Amount -->
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
                :max="saleDraft.total.value"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg font-bold text-center"
              />
              <div v-if="editableFinalAmount < saleDraft.total.value" class="text-xs text-green-600 text-center">
                {{ t('sales.discount_applied') }}: {{ formatCurrency(saleDraft.total.value - editableFinalAmount) }}
              </div>
            </div>
            <div v-else class="text-2xl font-bold text-center text-gray-900">
              {{ formatCurrency(saleDraft.total.value) }}
            </div>
          </div>

          <!-- Advance Payment Option -->
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
              <select v-model="paymentMethod" class="border border-gray-300 rounded-lg px-3 py-2 text-sm">
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
            <input v-model="dueDate" type="date" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-end gap-3">
          <UiButton variant="outline" @click="showCheckoutModal = false">
            {{ t('app.cancel') }}
          </UiButton>
          <UiButton
            :variant="paymentType === 'immediate' ? 'primary' : 'warning'"
            :loading="isConfirming"
            :disabled="!canConfirmSale"
            @click="confirmSale"
          >
            <Icon :name="paymentType === 'immediate' ? 'lucide:check' : 'lucide:clock'" class="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {{ paymentType === 'immediate' ? t('sales.confirm_paid') : t('sales.confirm_credit') }}
          </UiButton>
        </div>
      </template>
    </UiModal>

    <!-- Receipt Modal -->
    <UiModal
      :show="showReceiptModal"
      :title="t('sales.receipt')"
      size="lg"
      @close="closeReceipt"
    >
      <div v-if="confirmedSale" class="space-y-6">
        <!-- Receipt Header -->
        <div class="text-center border-b border-gray-200 pb-4">
          <h2 class="text-xl font-bold text-gray-900">Atlas Inventory</h2>
          <p class="text-sm text-gray-500 mt-1">{{ t('sales.receipt') }}</p>
          <p class="text-lg font-mono font-bold text-primary-600 mt-2">
            #{{ confirmedSale.id?.slice(-8).toUpperCase() }}
          </p>
          <p class="text-sm text-gray-500 mt-1">
            {{ formatDate(confirmedSale.confirmedAt || confirmedSale.createdAt) }}
          </p>
        </div>

        <!-- Client Info -->
        <div v-if="confirmedSale.clientName" class="bg-gray-50 rounded-lg p-4">
          <p class="text-sm text-gray-500">{{ t('sales.client') }}</p>
          <p class="font-medium text-gray-900">{{ confirmedSale.clientName }}</p>
          <p v-if="confirmedSale.clientInfo" class="text-sm text-gray-600 mt-1">
            {{ confirmedSale.clientInfo }}
          </p>
        </div>

        <!-- Items -->
        <div class="space-y-2">
          <div
            v-for="item in confirmedSale.items"
            :key="item.id"
            class="flex items-center justify-between py-2 border-b border-gray-100"
          >
            <div class="flex-1">
              <p class="font-medium text-gray-900">
                {{ item.product?.name }}
                <span v-if="item.variant" class="text-gray-500">
                  - {{ item.variant.name }}
                </span>
              </p>
              <p class="text-sm text-gray-500">
                {{ item.quantity }} × {{ formatCurrency(item.unitPrice) }}
              </p>
            </div>
            <p class="font-semibold text-gray-900">
              {{ formatCurrency(item.lineTotal) }}
            </p>
          </div>
        </div>

        <!-- Totals -->
        <div class="border-t border-gray-200 pt-4 space-y-2">
          <div class="flex items-center justify-between text-gray-600">
            <span>{{ t('sales.subtotal') }}</span>
            <span>{{ formatCurrency(confirmedSale.totalAmount - confirmedSale.taxAmount) }}</span>
          </div>
          <div class="flex items-center justify-between text-gray-600">
            <span>{{ t('sales.tax') }}</span>
            <span>{{ formatCurrency(confirmedSale.taxAmount) }}</span>
          </div>
          <div class="flex items-center justify-between font-bold text-xl pt-2 border-t border-gray-200">
            <span>{{ t('sales.total') }}</span>
            <span class="text-primary-600">{{ formatCurrency(confirmedSale.totalAmount) }}</span>
          </div>
        </div>

        <!-- Thank You -->
        <div class="text-center text-gray-500 text-sm pt-4 border-t border-dashed border-gray-200">
          {{ t('sales.thank_you') }}
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-between">
          <UiButton variant="outline" @click="closeReceipt">
            {{ t('sales.new_sale') }}
          </UiButton>
          <UiButton variant="primary" @click="printReceipt">
            <Icon name="lucide:printer" class="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {{ t('app.print') }}
          </UiButton>
        </div>
      </template>
    </UiModal>

    <!-- Variant Selection Modal -->
    <UiModal
      v-model:open="showVariantModal"
      :title="t('products.select_variant')"
      size="md"
    >
      <div v-if="pendingProduct" class="space-y-4">
        <div class="text-center pb-4 border-b border-gray-100">
          <h3 class="font-semibold text-lg text-gray-900">{{ pendingProduct.name }}</h3>
          <p class="text-sm text-gray-500">{{ t('sales.select_variant_to_add') }}</p>
        </div>
        
        <div class="grid gap-2">
          <button
            v-for="variant in pendingProduct.variants"
            :key="variant.id"
            @click="selectVariantForSale(variant)"
            class="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all"
            :class="{ 'opacity-50 cursor-not-allowed': (variant.stockQuantity || 0) <= 0 }"
            :disabled="(variant.stockQuantity || 0) <= 0"
          >
            <div class="text-left">
              <p class="font-medium text-gray-900">{{ variant.name }}</p>
              <p class="text-sm text-gray-500">
                {{ variant.sku || '-' }}
              </p>
            </div>
            <div class="text-right">
              <p class="font-semibold text-gray-900">{{ formatCurrency(variant.price || 0) }}</p>
              <p
                class="text-sm"
                :class="(variant.stockQuantity || 0) <= 0 ? 'text-red-600' : 'text-gray-500'"
              >
                {{ t('products.stock') }}: {{ variant.stockQuantity || 0 }}
              </p>
            </div>
          </button>
        </div>
      </div>

      <template #footer>
        <UiButton variant="outline" @click="closeVariantModal">
          {{ t('app.cancel') }}
        </UiButton>
      </template>
    </UiModal>
  </div>
</template>
