<script setup lang="ts">
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
} = saleDraft;

// Fetch suppliers for dropdown
const { data: suppliersData } = await useFetch('/api/suppliers');
const suppliers = computed(() => suppliersData.value || []);

// State
const confirming = ref(false);
const showClearConfirm = ref(false);
const showConfirmModal = ref(false);
const clientName = ref('');
const clientInfo = ref('');

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

// Open confirmation modal
const openConfirmModal = () => {
  if (items.value.length === 0) {
    showToast(t('sales.no_items_error'), 'error');
    return;
  }
  showConfirmModal.value = true;
};

// Confirm sale with client info
const confirmSale = async () => {
  confirming.value = true;
  try {
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

    // Now confirm the sale with client info
    await $fetch(`/api/sales/${draftResponse.id}/confirm`, {
      method: 'POST',
      body: {
        clientName: clientName.value || undefined,
        clientInfo: clientInfo.value || undefined,
      },
    });

    showToast(t('sales.sale_confirmed'), 'success');
    clearDraft();
    clientName.value = '';
    clientInfo.value = '';
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
                  <p class="text-sm text-primary-600 font-medium">
                    {{ formatCurrency(item.unitPrice) }} / {{ t('products.unit') }}
                  </p>
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
      @close="showConfirmModal = false"
    >
      <div class="space-y-4">
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

        <!-- Client Info Section -->
        <div class="border-t pt-4">
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
            variant="primary" 
            :loading="confirming"
            @click="confirmSale"
          >
            <Icon name="lucide:check" class="h-4 w-4 mr-2" />
            {{ t('sales.confirm_and_complete') }}
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
