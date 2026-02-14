<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import UiButton from '../ui/Button.vue';
import UiInput from '../ui/Input.vue';
import UiModal from '../ui/Modal.vue';
import { useToast } from '../../composables/useToast';

const props = defineProps<{
  reparation?: any;
  isEdit?: boolean;
}>();

const { showToast } = useToast();
const { t } = useI18n();

// Check if this is a draft being edited
const isDraft = computed(() => props.isEdit && props.reparation?.status === 'draft');

// Data
const customersData = ref<any[]>([]);
const productsData = ref<any[]>([]);

// Form state
const form = ref({
  customerId: null as string | null,
  customerSearchQuery: '',
  reportedIssue: '',
  diagnosis: '',
  repairNotes: '',
  depositAmount: 0,
  laborCost: 0,
  price: 0,
  isWarranty: false,
  items: [] as Array<{ 
    id: string; 
    productId: string | null; 
    name: string; 
    quantity: number;
    unitCost: number;
  }>,
});

const processing = ref(false);
const showCustomerDropdown = ref(false);
const showProductDropdown = ref<Record<string, boolean>>({});

// Auto-sync price with totalCost until user manually overrides
const priceManuallySet = ref(false);

function onPriceInput() {
  priceManuallySet.value = true;
}

function resetPriceToAuto() {
  priceManuallySet.value = false;
  form.value.price = totalCost.value;
}

// Load lookups
async function loadLookups() {
  try {
    const [customers, products] = await Promise.all([
      $fetch('/api/customers'),
      $fetch('/api/products'),
    ]);
    customersData.value = customers || [];
    productsData.value = products || [];
  } catch (e) {
    console.error('Failed to load lookups', e);
  }
}

onMounted(async () => {
  await loadLookups();
  
  if (props.isEdit && props.reparation) {
    form.value.customerId = props.reparation.customerId;
    form.value.customerSearchQuery = props.reparation.customer?.name || '';
    form.value.reportedIssue = props.reparation.reportedIssue || '';
    form.value.diagnosis = props.reparation.diagnosis || '';
    form.value.repairNotes = props.reparation.repairNotes || '';
    form.value.laborCost = props.reparation.laborCost || 0;
    form.value.price = props.reparation.price || 0;
    form.value.isWarranty = Boolean(props.reparation.isWarranty);
    
    // If the saved price differs from totalCost, the user had set it manually
    const savedTotalCost = (props.reparation.partsCost || 0) + (props.reparation.laborCost || 0);
    if (props.reparation.price && props.reparation.price !== savedTotalCost) {
      priceManuallySet.value = true;
    }
    
    // Load items
    if (props.reparation.items && props.reparation.items.length > 0) {
      form.value.items = props.reparation.items.map((item: any) => ({
        id: item.id || Date.now().toString(),
        productId: item.productId,
        name: item.product?.name || '',
        quantity: item.quantity || 1,
        unitCost: item.unitCost || 0,
      }));
    } else {
      addPartRow();
    }
  } else {
    addPartRow();
  }
});

// Customer selection
const filteredCustomers = computed(() => {
  if (!form.value.customerSearchQuery.trim()) return customersData.value;
  const q = form.value.customerSearchQuery.toLowerCase();
  return customersData.value.filter((c: any) => 
    (c.name || '').toLowerCase().includes(q) || 
    (c.phone || '').toLowerCase().includes(q)
  );
});

function selectCustomer(customer: any) {
  form.value.customerId = customer.id;
  form.value.customerSearchQuery = customer.name;
  showCustomerDropdown.value = false;
}

function clearCustomer() {
  form.value.customerId = null;
  form.value.customerSearchQuery = '';
}

// Parts management
function addPartRow() {
  form.value.items.push({
    id: Date.now().toString(),
    productId: null,
    name: '',
    quantity: 1,
    unitCost: 0,
  });
}

function removePartRow(id: string) {
  form.value.items = form.value.items.filter(item => item.id !== id);
}

function selectProductForRow(item: any, product: any) {
  item.productId = product.id;
  item.name = product.name;
  item.unitCost = product.costPrice || product.purchasePrice || 0;
  showProductDropdown.value[item.id] = false;
}

function getFilteredProducts(searchTerm: string) {
  if (!searchTerm) return [];
  const q = searchTerm.toLowerCase();
  return productsData.value.filter((p: any) => 
    p.name.toLowerCase().includes(q) || 
    (p.sku || '').toLowerCase().includes(q)
  );
}

// Computed costs
const partsCost = computed(() => {
  return form.value.items.reduce((sum, item) => {
    return sum + ((item.unitCost || 0) * (item.quantity || 0));
  }, 0);
});

const totalCost = computed(() => {
  return partsCost.value + (form.value.laborCost || 0);
});

// Auto-update price when totalCost changes (unless user manually set it)
watch(totalCost, (newVal) => {
  if (!priceManuallySet.value) {
    form.value.price = newVal;
  }
});

const showPaymentModal = ref(false);
const paymentType = ref<'immediate' | 'credit'>('immediate');
const paidAmount = ref(0);
const paymentMethod = ref('cash');

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile', label: 'Mobile Money' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' },
];

// Validate and show payment modal (or submit edit directly)
async function submit() {
  if (processing.value) return;
  
  // Basic validation
  if (!form.value.reportedIssue.trim()) {
    showToast(t('reparations.messages.issue_required'), 'error');
    return;
  }

  // If editing a non-draft, save directly
  if (props.isEdit && !isDraft.value) {
    await saveEdit();
  }
  // If editing a draft OR creating new — show payment modal to confirm
  else {
    if (!form.value.price || form.value.price <= 0) {
      form.value.price = totalCost.value;
    }
    paidAmount.value = form.value.price;
    showPaymentModal.value = true;
  }
}

// Save as draft (no payment modal needed)
async function saveDraft() {
  if (processing.value) return;
  processing.value = true;

  try {
    const body: any = {
      customerId: form.value.customerId || null,
      reportedIssue: form.value.reportedIssue || 'Draft',
      diagnosis: form.value.diagnosis || null,
      repairNotes: form.value.repairNotes || null,
      laborCost: form.value.laborCost || 0,
      price: form.value.price || 0,
      isWarranty: form.value.isWarranty,
      status: 'draft',
      items: form.value.items
        .filter(item => item.name.trim())
        .map(item => ({
          productId: item.productId || null,
          variantId: null,
          quantity: item.quantity || 1,
          unitCost: item.unitCost || 0,
        })),
    };

    if (props.isEdit && props.reparation) {
      // Update existing draft
      await $fetch(`/api/reparations/${props.reparation.id}`, { method: 'PATCH', body });
      showToast(t('reparations.messages.draft_saved'), 'success');
      navigateTo(`/reparations/${props.reparation.id}`);
    } else {
      // Create new draft
      const res = await $fetch<{ id: string }>('/api/reparations', { method: 'POST', body });
      showToast(t('reparations.messages.draft_saved'), 'success');
      await navigateTo(`/reparations/${res.id}`);
    }
  } catch (e: any) {
    showToast(e?.data?.message || e?.message || 'Error saving draft', 'error');
  } finally {
    processing.value = false;
  }
}

// Save edit without payment modal
async function saveEdit() {
  if (processing.value) return;
  processing.value = true;

  try {
    const body: any = {
      customerId: form.value.customerId || null,
      reportedIssue: form.value.reportedIssue,
      diagnosis: form.value.diagnosis || null,
      repairNotes: form.value.repairNotes || null,
      laborCost: form.value.laborCost || 0,
      price: form.value.price || 0,
      isWarranty: form.value.isWarranty,
      items: form.value.items
        .filter(item => item.name.trim())
        .map(item => ({
          productId: item.productId || null,
          variantId: null,
          quantity: item.quantity || 1,
          unitCost: item.unitCost || 0,
        })),
    };

    await $fetch(`/api/reparations/${props.reparation.id}`, { method: 'PATCH', body });
    showToast(t('reparations.messages.updated'), 'success');
    
    // Navigate to detail page
    navigateTo(`/reparations/${props.reparation.id}`);
  } catch (e: any) {
    showToast(e?.data?.message || e?.message || t('errors.server_error'), 'error');
  } finally {
    processing.value = false;
  }
}

// Actually submit the reparation (new creation or confirm draft)
async function confirmReparation() {
  if (processing.value) return;
  processing.value = true;

  try {
    const actualDepositAmount = paymentType.value === 'immediate' ? (form.value.price || 0) : (paidAmount.value || 0);
    
    const commonBody: any = {
      customerId: form.value.customerId || null,
      reportedIssue: form.value.reportedIssue,
      diagnosis: form.value.diagnosis || null,
      repairNotes: form.value.repairNotes || null,
      depositAmount: actualDepositAmount,
      laborCost: form.value.laborCost || 0,
      price: form.value.price || 0,
      isWarranty: form.value.isWarranty,
      paymentMethod: paymentMethod.value,
      paymentStatus: paymentType.value === 'immediate' ? 'paid' : (paidAmount.value >= (form.value.price || 0) ? 'paid' : paidAmount.value > 0 ? 'partial' : 'unpaid'),
      items: form.value.items
        .filter(item => item.name.trim())
        .map(item => ({
          productId: item.productId || null,
          variantId: null,
          quantity: item.quantity || 1,
          unitCost: item.unitCost || 0,
        })),
    };

    let targetId: string;

    if (isDraft.value && props.reparation) {
      // Confirm an existing draft → PATCH with confirmDraft
      commonBody.confirmDraft = true;
      await $fetch(`/api/reparations/${props.reparation.id}`, { method: 'PATCH', body: commonBody });
      targetId = props.reparation.id;
    } else {
      // Create new reparation
      console.log('Submitting reparation:', JSON.stringify(commonBody));
      const res = await $fetch<{ id: string }>('/api/reparations', { method: 'POST', body: commonBody });
      console.log('Reparation created:', res);
      targetId = res.id;
    }

    showToast(
      paymentType.value === 'immediate' 
        ? t('reparations.messages.created_and_paid')
        : t('reparations.messages.created'),
      'success'
    );
    
    showPaymentModal.value = false;
    await navigateTo(`/reparations/${targetId}`);
  } catch (e: any) {
    console.error('Reparation creation error:', e);
    const msg = e?.data?.message || e?.message || 'Error creating reparation';
    showToast(msg, 'error');
  } finally {
    processing.value = false;
  }
}

defineExpose({ submit, saveDraft });
</script>

<template>
  <div class="space-y-6">
    <!-- Customer Selection -->
    <div>
      <label class="text-sm font-medium text-gray-700">{{ $t('reparations.fields.customer') }}</label>
      <div class="relative mt-1">
        <UiInput
          v-model="form.customerSearchQuery"
          :placeholder="$t('reparations.fields.select_customer')"
          @focus="showCustomerDropdown = true"
          @input="showCustomerDropdown = true"
        />
        <div
          v-if="showCustomerDropdown && filteredCustomers.length > 0"
          class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-auto"
        >
          <div
            v-for="customer in filteredCustomers"
            :key="customer.id"
            class="p-2 hover:bg-gray-50 cursor-pointer"
            @click="selectCustomer(customer)"
          >
            <div class="font-medium text-sm">{{ customer.name }}</div>
            <div class="text-xs text-gray-500">{{ customer.phone || customer.email || '' }}</div>
          </div>
        </div>
      </div>
      <div v-if="form.customerId" class="mt-2 text-sm text-green-700">
        Selected: {{ form.customerSearchQuery }}
        <button class="text-red-500 ml-2" @click="clearCustomer">Clear</button>
      </div>
    </div>

    <!-- Reported Issue -->
    <div>
      <label class="text-sm font-medium text-gray-700">
        {{ $t('reparations.fields.reported_issue') }} <span class="text-red-500">*</span>
      </label>
      <textarea
        v-model="form.reportedIssue"
        :placeholder="$t('reparations.fields.reported_issue_placeholder')"
        class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        rows="3"
      ></textarea>
    </div>

    <!-- Diagnosis -->
    <div>
      <label class="text-sm font-medium text-gray-700">{{ $t('reparations.fields.diagnosis') }}</label>
      <textarea
        v-model="form.diagnosis"
        :placeholder="$t('reparations.fields.diagnosis_placeholder')"
        class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        rows="3"
      ></textarea>
    </div>

    <!-- Repair Notes -->
    <div>
      <label class="text-sm font-medium text-gray-700">{{ $t('reparations.fields.repair_notes') }}</label>
      <textarea
        v-model="form.repairNotes"
        :placeholder="$t('reparations.fields.repair_notes_placeholder')"
        class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        rows="3"
      ></textarea>
    </div>

    <!-- Parts & Materials -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <label class="text-sm font-medium text-gray-700">{{ $t('reparations.fields.parts') }}</label>
        <button
          type="button"
          class="text-sm text-indigo-600 hover:text-indigo-700"
          @click="addPartRow"
        >
          {{ $t('reparations.fields.add_part') }}
        </button>
      </div>

      <div class="space-y-2">
        <div
          v-for="item in form.items"
          :key="item.id"
          class="grid grid-cols-12 gap-2 items-center p-2 border border-gray-200 rounded-lg"
        >
          <!-- Part Name/Product Search -->
          <div class="col-span-5 relative">
            <UiInput
              v-model="item.name"
              :placeholder="$t('reparations.fields.search_product')"
              @focus="showProductDropdown[item.id] = true"
              @input="showProductDropdown[item.id] = true"
            />
            <div
              v-if="showProductDropdown[item.id] && item.name && getFilteredProducts(item.name).length > 0"
              class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-auto"
            >
              <div
                v-for="product in getFilteredProducts(item.name)"
                :key="product.id"
                class="p-2 hover:bg-gray-50 cursor-pointer"
                @click="selectProductForRow(item, product)"
              >
                <div class="font-medium text-sm">{{ product.name }}</div>
                <div class="text-xs text-gray-500">{{ product.sku }}</div>
              </div>
            </div>
          </div>

          <!-- Quantity -->
          <div class="col-span-2">
            <UiInput
              type="number"
              v-model.number="item.quantity"
              min="1"
              placeholder="Qty"
            />
          </div>

          <!-- Unit Cost -->
          <div class="col-span-2">
            <UiInput
              type="number"
              step="0.01"
              v-model.number="item.unitCost"
              placeholder="Cost"
            />
          </div>

          <!-- Line Total -->
          <div class="col-span-2 text-right font-medium text-sm">
            {{ ((item.unitCost || 0) * (item.quantity || 0)).toFixed(2) }}
          </div>

          <!-- Remove Button -->
          <div class="col-span-1 text-center">
            <button
              type="button"
              class="text-red-500 hover:text-red-700"
              @click="removePartRow(item.id)"
            >
              <Icon name="lucide:x" class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Costs Summary -->
    <div class="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div>
        <label class="text-xs text-gray-600">{{ $t('reparations.fields.parts_cost') }}</label>
        <div class="text-lg font-semibold text-gray-900">{{ partsCost.toFixed(2) }}</div>
      </div>
      <div>
        <label class="text-xs text-gray-600">{{ $t('reparations.fields.labor_cost') }}</label>
        <UiInput type="number" step="0.01" v-model.number="form.laborCost" />
      </div>
      <div>
        <label class="text-xs text-gray-600">{{ $t('reparations.fields.total_cost') }}</label>
        <div class="text-lg font-semibold text-gray-900">{{ totalCost.toFixed(2) }}</div>
      </div>
    </div>

    <!-- Customer Price (visible during edit, and for new) -->
    <div>
      <label class="text-sm font-medium text-gray-700">{{ $t('reparations.fields.price') }}</label>
      <div class="mt-1 relative flex items-center gap-2">
        <div class="flex-1">
          <UiInput
            type="number"
            step="0.01"
            min="0"
            v-model.number="form.price"
            :placeholder="totalCost.toFixed(2)"
            @input="onPriceInput"
          />
        </div>
        <button
          v-if="priceManuallySet"
          type="button"
          @click="resetPriceToAuto"
          class="text-xs text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
          :title="$t('reparations.fields.reset_price')"
        >
          ↻ Auto
        </button>
      </div>
      <p class="text-xs text-gray-500 mt-1">
        {{ priceManuallySet ? $t('reparations.fields.price_manual') : $t('reparations.fields.price_hint') }}
      </p>
    </div>

    <!-- Warranty Checkbox -->
    <div class="flex items-center gap-2">
      <input
        type="checkbox"
        id="isWarranty"
        v-model="form.isWarranty"
        class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />
      <label for="isWarranty" class="text-sm text-gray-700">{{ $t('reparations.fields.is_warranty') }}</label>
    </div>

    <!-- Action Buttons -->
    <div class="flex justify-end gap-3 pt-4 border-t">
      <UiButton variant="outline" @click="navigateTo(isEdit ? `/reparations/${reparation.id}` : '/reparations')">{{ $t('app.cancel') }}</UiButton>
      <!-- Save as Draft button (for new reparations and existing drafts) -->
      <UiButton 
        v-if="!isEdit || isDraft"
        variant="outline" 
        :disabled="processing" 
        @click="saveDraft"
      >
        <Icon name="lucide:save" class="h-4 w-4 mr-2" />
        {{ $t('reparations.actions.save_draft') }}
      </UiButton>
      <UiButton :disabled="processing" @click="submit">
        {{ processing ? $t('app.loading') : (isDraft ? $t('reparations.actions.confirm_repair') : isEdit ? $t('app.save') : $t('reparations.create')) }}
      </UiButton>
    </div>

    <!-- Payment Modal (for new reparations and draft confirmations) -->
    <UiModal v-if="!isEdit || isDraft" v-model:open="showPaymentModal" title="Payment & Confirmation" size="lg">
      <div class="space-y-5">
        <!-- Cost Summary -->
        <div class="bg-gray-50 rounded-lg p-4">
          <div class="flex justify-between">
            <span class="text-sm text-gray-500">Total Cost (parts + labor)</span>
            <span class="text-sm font-semibold">{{ totalCost.toFixed(2) }}</span>
          </div>
        </div>

        <!-- Customer Price (editable in modal) -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('reparations.fields.price') }}</label>
          <div class="flex items-center gap-2">
            <input
              v-model.number="form.price"
              type="number"
              step="0.01"
              min="0"
              class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-lg font-semibold"
              :placeholder="totalCost.toFixed(2)"
              @input="onPriceInput"
            />
            <button
              v-if="priceManuallySet"
              type="button"
              @click="resetPriceToAuto"
              class="text-xs text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
            >
              ↻ Auto
            </button>
          </div>
          <p class="text-xs text-gray-500 mt-1">
            {{ priceManuallySet ? $t('reparations.fields.price_manual') : $t('reparations.fields.price_hint') }}
          </p>
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
              @click="paymentType = 'immediate'"
            >
              <Icon name="lucide:banknote" class="h-5 w-5 mx-auto mb-1" />
              <div class="text-sm">Pay Now</div>
              <div class="text-xs opacity-75">Full payment received</div>
            </button>
            <button
              type="button"
              :class="[
                'py-4 px-4 text-center transition-colors font-medium border-l',
                paymentType === 'credit' 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              ]"
              @click="paymentType = 'credit'"
            >
              <Icon name="lucide:clock" class="h-5 w-5 mx-auto mb-1" />
              <div class="text-sm">Pay Later</div>
              <div class="text-xs opacity-75">Partial or unpaid</div>
            </button>
          </div>
        </div>

        <!-- Immediate Payment Section -->
        <div v-if="paymentType === 'immediate'" class="bg-green-50 border border-green-200 rounded-lg p-4">
          <div class="flex items-center gap-2 text-green-700 mb-2">
            <Icon name="lucide:check-circle" class="h-5 w-5" />
            <span class="font-medium">Full Payment Received</span>
          </div>
          <p class="text-sm text-green-600">
            Amount: <strong>{{ (form.price || 0).toFixed(2) }}</strong>
          </p>
          
          <div class="mt-3">
            <label class="block text-sm text-green-700 mb-1">Payment Method</label>
            <select
              v-model="paymentMethod"
              class="w-full border border-green-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option v-for="method in paymentMethods" :key="method.value" :value="method.value">
                {{ method.label }}
              </option>
            </select>
          </div>
        </div>

        <!-- Credit Payment Section -->
        <div v-else class="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div class="flex items-center gap-2 text-orange-700 mb-3">
            <Icon name="lucide:alert-circle" class="h-5 w-5" />
            <span class="font-medium">Partial or Unpaid</span>
          </div>
          
          <div class="mb-3">
            <label class="block text-sm text-orange-700 mb-1">Deposit Amount (optional)</label>
            <input
              v-model.number="paidAmount"
              type="number"
              step="0.01"
              min="0"
              :max="form.price || 0"
              class="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm"
              placeholder="0.00"
            />
          </div>
          
          <div v-if="paidAmount > 0" class="mb-3">
            <label class="block text-sm text-orange-700 mb-1">Payment Method</label>
            <select
              v-model="paymentMethod"
              class="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option v-for="method in paymentMethods" :key="method.value" :value="method.value">
                {{ method.label }}
              </option>
            </select>
          </div>

          <div class="text-sm text-orange-600">
            Outstanding: <strong>{{ Math.max(0, (form.price || 0) - paidAmount).toFixed(2) }}</strong>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3 pt-4">
          <UiButton variant="outline" @click="showPaymentModal = false" :disabled="processing">
            Cancel
          </UiButton>
          <UiButton @click="confirmReparation" :disabled="processing || !form.price || form.price <= 0">
            <Icon v-if="processing" name="lucide:loader-2" class="h-4 w-4 mr-2 animate-spin" />
            {{ paymentType === 'immediate' ? 'Confirm & Pay' : 'Confirm' }}
          </UiButton>
        </div>
      </div>
    </UiModal>
  </div>
</template>

