<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import UiModal from '../ui/Modal.vue';
import UiButton from '../ui/Button.vue';
import { useToast } from '../../composables/useToast';

const { t } = useI18n();
const props = defineProps<{ sale: any, open: boolean }>();
const emit = defineEmits(['update:open','processed']);

const items = ref((props.sale?.items || []).map((it: any) => ({
  saleItemId: it.id,
  productId: it.productId,
  variantId: it.variantId,
  name: it.product?.name + (it.variant ? ` - ${it.variant.name}` : ''),
  unitPrice: it.unitPrice || 0,
  maxQuantity: it.quantity || 0,
  quantity: 0,
  restock: true,
})));

watch(() => props.sale, (s) => {
  items.value = (s?.items || []).map((it: any) => ({
    saleItemId: it.id,
    productId: it.productId,
    variantId: it.variantId,
    name: it.product?.name + (it.variant ? ` - ${it.variant.name}` : ''),
    unitPrice: it.unitPrice || 0,
    maxQuantity: it.quantity || 0,
    quantity: 0,
    restock: true,
  }));
  // Reset refund amount when sale changes
  manualRefundAmount.value = null;
});

const manualRefundAmount = ref<number | null>(null);
const refundMethod = ref('cash');
const processing = ref(false);
const { showToast } = useToast();

const selectedItems = computed(() => items.value.filter(i => i.quantity > 0));

// Auto-calculate refund based on items being returned
const calculatedRefund = computed(() => {
  return selectedItems.value.reduce((sum, item) => {
    return sum + (item.unitPrice * item.quantity);
  }, 0);
});

// Use manual refund if set, otherwise use calculated
const refundAmount = computed({
  get: () => manualRefundAmount.value !== null ? manualRefundAmount.value : calculatedRefund.value,
  set: (val) => manualRefundAmount.value = val,
});

async function submit(processNow = true) {
  if (selectedItems.value.length === 0) {
    showToast(t('returns.fields.select_one_item'), 'error');
    return;
  }
  processing.value = true;
  try {
    const payload: any = {
      saleId: props.sale.id,
      items: selectedItems.value.map(i => ({ 
        saleItemId: i.saleItemId, 
        productId: i.productId, 
        variantId: i.variantId, 
        quantity: i.quantity, 
        restock: i.restock 
      })),
      reason: 'Customer return',
      processNow,
    };
    if (processNow && refundAmount.value > 0) {
      payload.refund = { amount: refundAmount.value, method: refundMethod.value };
    }

    const res = await $fetch('/api/returns', { method: 'POST', body: payload });
    if (processNow) {
      // process immediately
      await $fetch(`/api/returns/${res.id}/process`, { 
        method: 'POST', 
        body: { 
          refund: payload.refund,
          restock: selectedItems.value.some(i => i.restock),
        } 
      });
    }

    showToast(t('returns.fields.success'), 'success');
    emit('update:open', false);
    emit('processed');
  } catch (e: any) {
    showToast(e?.message || t('returns.fields.error'), 'error');
  } finally {
    processing.value = false;
  }
}
</script>

<template>
  <UiModal :open="open" :title="t('returns.create')" size="lg" @update:open="$emit('update:open', $event)">
    <div class="space-y-4">
      <!-- Items Selection -->
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-gray-700">{{ t('returns.fields.select_items') }}</h3>
        <div v-for="it in items" :key="it.saleItemId" class="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
          <div class="flex-1">
            <div class="font-medium text-gray-900">{{ it.name }}</div>
            <div class="text-sm text-gray-500">
              {{ t('returns.fields.max_quantity') }}: {{ it.maxQuantity }} × {{ it.unitPrice.toFixed(2) }} = {{ (it.maxQuantity * it.unitPrice).toFixed(2) }}
            </div>
          </div>
          <div class="w-32">
            <label class="text-xs text-gray-600">{{ t('returns.fields.quantity') }}</label>
            <input 
              type="number" 
              min="0" 
              :max="it.maxQuantity" 
              v-model.number="it.quantity" 
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              @input="manualRefundAmount = null"
            />
          </div>
          <div class="w-28 flex items-center gap-2">
            <input type="checkbox" v-model="it.restock" class="rounded border-gray-300" />
            <label class="text-sm text-gray-700">{{ t('returns.fields.restock') }}</label>
          </div>
        </div>
      </div>

      <!-- Refund Summary -->
      <div v-if="selectedItems.length > 0" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 class="text-sm font-medium text-blue-800 mb-3">{{ t('returns.fields.refund_details') }}</h3>
        
        <div class="space-y-2 mb-3">
          <div class="flex justify-between text-sm">
            <span class="text-blue-700">{{ t('returns.fields.items_returned') }}:</span>
            <span class="font-medium text-blue-900">{{ selectedItems.length }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-blue-700">{{ t('returns.fields.calculated_refund') }}:</span>
            <span class="font-medium text-blue-900">{{ calculatedRefund.toFixed(2) }}</span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm text-blue-800 mb-1">
              {{ t('returns.fields.refund_amount') }}
              <span class="text-xs text-blue-600">({{ t('returns.fields.editable') }})</span>
            </label>
            <input 
              type="number" 
              step="0.01" 
              v-model.number="refundAmount" 
              class="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm bg-white"
            />
          </div>
          <div>
            <label class="block text-sm text-blue-800 mb-1">{{ t('returns.fields.refund_method') }}</label>
            <select 
              v-model="refundMethod" 
              class="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="cash">{{ t('sales.cash') }}</option>
              <option value="card">{{ t('sales.card') }}</option>
              <option value="bank_transfer">{{ t('sales.transfer') }}</option>
              <option value="mobile">{{ t('sales.mobile') || 'Mobile' }}</option>
            </select>
          </div>
        </div>

        <p class="text-xs text-blue-600 mt-2">
          <Icon name="lucide:info" class="h-3 w-3 inline mr-1" />
          {{ t('returns.fields.refund_info') }}
        </p>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-3 pt-4 border-t">
        <UiButton variant="outline" @click="$emit('update:open', false)" :disabled="processing">
          {{ t('app.cancel') }}
        </UiButton>
        <UiButton @click="submit(true)" :disabled="processing || selectedItems.length === 0">
          <Icon v-if="processing" name="lucide:loader-2" class="h-4 w-4 mr-2 animate-spin" />
          {{ t('returns.actions.process_return') }}
        </UiButton>
      </div>
    </div>
  </UiModal>
</template>

<style scoped>
</style>
