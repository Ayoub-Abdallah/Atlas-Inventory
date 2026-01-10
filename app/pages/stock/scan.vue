<script setup lang="ts">
definePageMeta({
  layout: 'default',
});

const { t, locale } = useI18n();
const { addToast } = useToast();

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
  const taxRate = product.tax?.rate ?? 0;
  
  saleDraft.addItem({
    productId: product.id,
    variantId: variant?.id,
    productName: product.name,
    variantName: variant?.name,
    sku: variant?.sku ?? product.sku,
    quantity: 1,
    unitPrice: price,
    unitCost: cost,
    taxRate,
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
  showCheckoutModal.value = true;
}

async function confirmSale() {
  if (saleDraft.isEmpty.value) return;
  
  isConfirming.value = true;
  try {
    // First create the sale
    const sale = await saleDraft.createSale();
    
    // Then confirm it with client info
    const confirmed = await $fetch(`/api/sales/${(sale as any).id}/confirm`, {
      method: 'POST',
      body: {
        clientName: clientName.value || undefined,
        clientInfo: clientInfo.value || undefined,
      },
    });
    
    confirmedSale.value = confirmed;
    saleDraft.clearDraft();
    
    showCheckoutModal.value = false;
    showReceiptModal.value = true;
    
    // Reset client info
    clientName.value = '';
    clientInfo.value = '';
    
    addToast({
      title: t('sales.sale_confirmed'),
      message: t('sales.sale_success'),
      type: 'success',
    });
  } catch (error: any) {
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
        message: error.message || t('sales.sale_failed'),
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
      <div class="space-y-6">
        <!-- Order Summary -->
        <div class="bg-gray-50 rounded-lg p-4">
          <h4 class="font-medium text-gray-900 mb-3">{{ t('sales.order_summary') }}</h4>
          <div class="space-y-2 max-h-48 overflow-y-auto">
            <div
              v-for="item in saleDraft.items.value"
              :key="item.id"
              class="flex items-center justify-between text-sm"
            >
              <span class="text-gray-700">
                {{ item.quantity }}x {{ item.productName }}
                <span v-if="item.variantName" class="text-gray-500">({{ item.variantName }})</span>
              </span>
              <span class="font-medium">{{ formatCurrency(item.lineTotal) }}</span>
            </div>
          </div>
          <div class="border-t border-gray-200 mt-3 pt-3 flex items-center justify-between font-bold">
            <span>{{ t('sales.total') }}</span>
            <span class="text-lg text-primary-600">{{ formatCurrency(saleDraft.total.value) }}</span>
          </div>
        </div>

        <!-- Client Info (Optional) -->
        <div class="space-y-4">
          <h4 class="font-medium text-gray-900">{{ t('sales.client_info_optional') }}</h4>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ t('sales.client_name') }}
            </label>
            <input
              v-model="clientName"
              type="text"
              class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              :placeholder="t('sales.client_name_placeholder')"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ t('sales.client_notes') }}
            </label>
            <textarea
              v-model="clientInfo"
              rows="2"
              class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              :placeholder="t('sales.client_notes_placeholder')"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-end gap-3">
          <UiButton variant="outline" @click="showCheckoutModal = false">
            {{ t('app.cancel') }}
          </UiButton>
          <UiButton
            variant="primary"
            :loading="isConfirming"
            @click="confirmSale"
          >
            <Icon name="lucide:check" class="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {{ t('sales.confirm_and_print') }}
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
