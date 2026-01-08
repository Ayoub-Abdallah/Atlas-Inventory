<script setup lang="ts">
import type { ZakatSettings, ZakatHistory } from '~~/server/database/schema';

definePageMeta({
  layout: 'default',
});

const { t, locale } = useI18n();
const toast = useToast();

// Fetch data
const { data: settings, refresh: refreshSettings } = await useFetch('/api/zakat/settings');
const { data: history, refresh: refreshHistory } = await useFetch('/api/zakat/history');

// State
const isCalculating = ref(false);
const calculationResult = ref<any>(null);
const showSettingsModal = ref(false);
const showPayModal = ref(false);
const selectedRecord = ref<ZakatHistory | null>(null);
const isSaving = ref(false);

// Settings form
const settingsForm = reactive({
  nisabGoldGrams: 85,
  goldPricePerGram: 0,
  currency: 'DZD',
  zakatRate: 2.5,
  cashBalance: 0,
  receivables: 0,
  otherAssets: 0,
  shortTermLiabilities: 0,
  hawlStartDate: '',
});

// Payment form
const paymentForm = reactive({
  paidAmount: 0,
  paymentMethod: '',
  paymentReference: '',
  notes: '',
});

// Watch settings and populate form
watch(settings, (newSettings) => {
  if (newSettings) {
    settingsForm.nisabGoldGrams = newSettings.nisabGoldGrams || 85;
    settingsForm.goldPricePerGram = newSettings.goldPricePerGram || 0;
    settingsForm.currency = newSettings.currency || 'DZD';
    settingsForm.zakatRate = newSettings.zakatRate || 2.5;
    settingsForm.cashBalance = newSettings.cashBalance || 0;
    settingsForm.receivables = newSettings.receivables || 0;
    settingsForm.otherAssets = newSettings.otherAssets || 0;
    settingsForm.shortTermLiabilities = newSettings.shortTermLiabilities || 0;
    settingsForm.hawlStartDate = newSettings.hawlStartDate 
      ? new Date(newSettings.hawlStartDate).toISOString().split('T')[0] 
      : '';
  }
}, { immediate: true });

// Computed nisab value
const computedNisabValue = computed(() => {
  return settingsForm.nisabGoldGrams * settingsForm.goldPricePerGram;
});

// Calculate zakat
async function calculateZakat() {
  isCalculating.value = true;
  try {
    const result = await $fetch('/api/zakat/calculate', { method: 'POST' });
    calculationResult.value = result;
    toast.success(t('zakat.calculation_complete'));
  } catch (error: any) {
    toast.error(error.message || t('errors.server_error'));
  } finally {
    isCalculating.value = false;
  }
}

// Save settings
async function saveSettings() {
  isSaving.value = true;
  try {
    await $fetch('/api/zakat/settings', {
      method: 'POST',
      body: settingsForm,
    });
    toast.success(t('app.saved'));
    showSettingsModal.value = false;
    refreshSettings();
  } catch (error: any) {
    toast.error(error.message || t('errors.server_error'));
  } finally {
    isSaving.value = false;
  }
}

// Record current calculation
async function recordCalculation() {
  if (!calculationResult.value) return;
  
  isSaving.value = true;
  try {
    await $fetch('/api/zakat/history', {
      method: 'POST',
      body: {
        ...calculationResult.value,
        nisabAtTime: calculationResult.value.nisabValue,
      },
    });
    toast.success(t('zakat.recorded'));
    refreshHistory();
    calculationResult.value = null;
  } catch (error: any) {
    toast.error(error.message || t('errors.server_error'));
  } finally {
    isSaving.value = false;
  }
}

// Open pay modal
function openPayModal(record: ZakatHistory) {
  selectedRecord.value = record;
  paymentForm.paidAmount = record.zakatAmount;
  paymentForm.paymentMethod = '';
  paymentForm.paymentReference = '';
  paymentForm.notes = record.notes || '';
  showPayModal.value = true;
}

// Mark as paid
async function markAsPaid() {
  if (!selectedRecord.value) return;
  
  isSaving.value = true;
  try {
    await $fetch(`/api/zakat/${selectedRecord.value.id}/pay`, {
      method: 'POST',
      body: paymentForm,
    });
    toast.success(t('zakat.marked_paid'));
    showPayModal.value = false;
    refreshHistory();
  } catch (error: any) {
    toast.error(error.message || t('errors.server_error'));
  } finally {
    isSaving.value = false;
  }
}

// Delete record
async function deleteRecord(id: string) {
  if (!confirm(t('app.confirm_delete'))) return;
  
  try {
    await $fetch(`/api/zakat/${id}`, { method: 'DELETE' });
    toast.success(t('app.deleted'));
    refreshHistory();
  } catch (error: any) {
    toast.error(error.message || t('errors.server_error'));
  }
}

// Format currency
const formatCurrency = (value: number) => {
  const currency = settings.value?.currency || 'DZD';
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
const formatDate = (date: Date | string | number) => {
  return new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-DZ' : 'fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
};

// Payment methods
const paymentMethods = [
  { value: 'cash', label: t('zakat.payment_cash') },
  { value: 'bank', label: t('zakat.payment_bank') },
  { value: 'charity', label: t('zakat.payment_charity') },
  { value: 'other', label: t('zakat.payment_other') },
];

// Load calculation on mount
onMounted(() => {
  calculateZakat();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Icon name="lucide:coins" class="h-6 w-6 text-primary-600" />
          {{ t('zakat.title') }}
        </h1>
        <p class="text-sm text-gray-500 mt-1">{{ t('zakat.description') }}</p>
      </div>
      <div class="flex gap-2">
        <button 
          class="btn-secondary"
          @click="showSettingsModal = true"
        >
          <Icon name="lucide:settings" class="h-4 w-4" />
          {{ t('zakat.settings') }}
        </button>
        <button 
          class="btn-primary"
          :disabled="isCalculating"
          @click="calculateZakat"
        >
          <Icon 
            :name="isCalculating ? 'lucide:loader-2' : 'lucide:calculator'" 
            class="h-4 w-4" 
            :class="{ 'animate-spin': isCalculating }"
          />
          {{ t('zakat.calculate') }}
        </button>
      </div>
    </div>

    <!-- Info Cards Row -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- Nisab Info -->
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
            <Icon name="lucide:scale" class="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p class="text-xs text-gray-500">{{ t('zakat.nisab_threshold') }}</p>
            <p class="text-lg font-semibold text-gray-900">
              {{ formatCurrency(settings?.nisabValue || 0) }}
            </p>
            <p class="text-xs text-gray-400">
              {{ settings?.nisabGoldGrams || 85 }}g × {{ formatCurrency(settings?.goldPricePerGram || 0) }}/g
            </p>
          </div>
        </div>
      </div>

      <!-- Zakat Rate -->
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
            <Icon name="lucide:percent" class="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p class="text-xs text-gray-500">{{ t('zakat.rate') }}</p>
            <p class="text-lg font-semibold text-gray-900">{{ settings?.zakatRate || 2.5 }}%</p>
            <p class="text-xs text-gray-400">{{ t('zakat.standard_rate') }}</p>
          </div>
        </div>
      </div>

      <!-- Hawl Status -->
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
            <Icon name="lucide:calendar" class="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p class="text-xs text-gray-500">{{ t('zakat.hawl_start') }}</p>
            <p class="text-lg font-semibold text-gray-900">
              {{ settings?.hawlStartDate ? formatDate(settings.hawlStartDate) : t('zakat.not_set') }}
            </p>
            <p class="text-xs text-gray-400">{{ t('zakat.lunar_year') }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Current Calculation Result -->
    <div v-if="calculationResult" class="card overflow-hidden">
      <div class="border-b border-gray-100 bg-gray-50 px-6 py-4">
        <h2 class="font-semibold text-gray-900 flex items-center gap-2">
          <Icon name="lucide:calculator" class="h-5 w-5 text-primary-600" />
          {{ t('zakat.current_calculation') }}
        </h2>
      </div>
      
      <div class="p-6">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Assets Breakdown -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
              <Icon name="lucide:wallet" class="h-4 w-4" />
              {{ t('zakat.assets_breakdown') }}
            </h3>
            <div class="space-y-3">
              <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-sm text-gray-600">{{ t('zakat.inventory_value') }}</span>
                <span class="font-medium text-gray-900">{{ formatCurrency(calculationResult.inventoryValue) }}</span>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-sm text-gray-600">{{ t('zakat.cash_balance') }}</span>
                <span class="font-medium text-gray-900">{{ formatCurrency(calculationResult.cashBalance) }}</span>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-sm text-gray-600">{{ t('zakat.receivables') }}</span>
                <span class="font-medium text-gray-900">{{ formatCurrency(calculationResult.receivables) }}</span>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-sm text-gray-600">{{ t('zakat.other_assets') }}</span>
                <span class="font-medium text-gray-900">{{ formatCurrency(calculationResult.otherAssets) }}</span>
              </div>
              <div class="flex justify-between items-center py-2 bg-gray-50 px-3 rounded-lg">
                <span class="text-sm font-medium text-gray-700">{{ t('zakat.total_assets') }}</span>
                <span class="font-bold text-gray-900">{{ formatCurrency(calculationResult.totalAssets) }}</span>
              </div>
            </div>

            <!-- Liabilities -->
            <h3 class="text-sm font-medium text-gray-700 mt-6 mb-4 flex items-center gap-2">
              <Icon name="lucide:minus-circle" class="h-4 w-4" />
              {{ t('zakat.liabilities') }}
            </h3>
            <div class="flex justify-between items-center py-2 bg-red-50 px-3 rounded-lg">
              <span class="text-sm text-red-700">{{ t('zakat.short_term_liabilities') }}</span>
              <span class="font-medium text-red-700">-{{ formatCurrency(calculationResult.shortTermLiabilities) }}</span>
            </div>
          </div>

          <!-- Zakat Calculation -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
              <Icon name="lucide:calculator" class="h-4 w-4" />
              {{ t('zakat.calculation') }}
            </h3>
            
            <div class="space-y-4">
              <!-- Net Assets -->
              <div class="p-4 bg-gray-50 rounded-lg">
                <div class="flex justify-between items-center">
                  <span class="text-sm text-gray-600">{{ t('zakat.net_zakatable_assets') }}</span>
                  <span class="text-xl font-bold text-gray-900">{{ formatCurrency(calculationResult.netZakatableAssets) }}</span>
                </div>
              </div>

              <!-- Nisab Comparison -->
              <div 
                class="p-4 rounded-lg border-2"
                :class="calculationResult.meetsNisab ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'"
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-medium" :class="calculationResult.meetsNisab ? 'text-green-700' : 'text-gray-700'">
                    {{ t('zakat.nisab_comparison') }}
                  </span>
                  <span 
                    class="px-2 py-1 rounded-full text-xs font-medium"
                    :class="calculationResult.meetsNisab ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-700'"
                  >
                    {{ calculationResult.meetsNisab ? t('zakat.nisab_met') : t('zakat.nisab_not_met') }}
                  </span>
                </div>
                <div class="text-sm text-gray-600">
                  {{ formatCurrency(calculationResult.netZakatableAssets) }} 
                  {{ calculationResult.meetsNisab ? '≥' : '<' }} 
                  {{ formatCurrency(calculationResult.nisabValue) }}
                </div>
              </div>

              <!-- Zakat Amount -->
              <div 
                class="p-6 rounded-lg text-center"
                :class="calculationResult.meetsNisab ? 'bg-primary-600' : 'bg-gray-200'"
              >
                <p 
                  class="text-sm mb-2"
                  :class="calculationResult.meetsNisab ? 'text-primary-100' : 'text-gray-600'"
                >
                  {{ t('zakat.zakat_due') }}
                </p>
                <p 
                  class="text-3xl font-bold"
                  :class="calculationResult.meetsNisab ? 'text-white' : 'text-gray-500'"
                >
                  {{ formatCurrency(calculationResult.zakatAmount) }}
                </p>
                <p 
                  class="text-xs mt-2"
                  :class="calculationResult.meetsNisab ? 'text-primary-200' : 'text-gray-500'"
                >
                  {{ calculationResult.zakatRate }}% × {{ formatCurrency(calculationResult.netZakatableAssets) }}
                </p>
              </div>

              <!-- Record Button -->
              <button
                v-if="calculationResult.meetsNisab"
                class="w-full btn-primary"
                :disabled="isSaving"
                @click="recordCalculation"
              >
                <Icon name="lucide:save" class="h-4 w-4" />
                {{ t('zakat.record_calculation') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- History Table -->
    <div class="card overflow-hidden">
      <div class="border-b border-gray-100 bg-gray-50 px-6 py-4">
        <h2 class="font-semibold text-gray-900 flex items-center gap-2">
          <Icon name="lucide:history" class="h-5 w-5 text-gray-600" />
          {{ t('zakat.history') }}
        </h2>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{{ t('app.date') }}</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{{ t('zakat.net_assets') }}</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{{ t('zakat.zakat_amount') }}</th>
              <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{{ t('zakat.status') }}</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{{ t('app.actions') }}</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="record in history" :key="record.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm text-gray-900">{{ formatDate(record.zakatDate) }}</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right">
                <span class="text-sm font-medium text-gray-900">{{ formatCurrency(record.netZakatableAssets) }}</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right">
                <span class="text-sm font-bold text-primary-600">{{ formatCurrency(record.zakatAmount) }}</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-center">
                <span 
                  class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                  :class="record.isPaid ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'"
                >
                  <Icon :name="record.isPaid ? 'lucide:check-circle' : 'lucide:clock'" class="h-3 w-3" />
                  {{ record.isPaid ? t('zakat.paid') : t('zakat.pending') }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    v-if="!record.isPaid"
                    class="text-green-600 hover:text-green-800"
                    :title="t('zakat.mark_paid')"
                    @click="openPayModal(record)"
                  >
                    <Icon name="lucide:check" class="h-4 w-4" />
                  </button>
                  <button
                    class="text-red-600 hover:text-red-800"
                    :title="t('app.delete')"
                    @click="deleteRecord(record.id)"
                  >
                    <Icon name="lucide:trash-2" class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!history?.length">
              <td colspan="5" class="px-6 py-12 text-center">
                <Icon name="lucide:inbox" class="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p class="text-sm text-gray-500">{{ t('zakat.no_history') }}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Settings Modal -->
    <UiModal v-model:open="showSettingsModal" :title="t('zakat.settings')" size="lg">
      <form @submit.prevent="saveSettings" class="space-y-6">
        <!-- Nisab Settings -->
        <div class="space-y-4">
          <h3 class="font-medium text-gray-900 flex items-center gap-2">
            <Icon name="lucide:scale" class="h-4 w-4" />
            {{ t('zakat.nisab_settings') }}
          </h3>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">{{ t('zakat.gold_grams') }}</label>
              <input 
                v-model.number="settingsForm.nisabGoldGrams" 
                type="number" 
                step="0.01"
                class="input"
              />
              <p class="text-xs text-gray-500 mt-1">{{ t('zakat.standard_85g') }}</p>
            </div>
            <div>
              <label class="label">{{ t('zakat.gold_price_per_gram') }}</label>
              <input 
                v-model.number="settingsForm.goldPricePerGram" 
                type="number" 
                step="0.01"
                class="input"
              />
            </div>
          </div>

          <div class="p-3 bg-amber-50 rounded-lg">
            <p class="text-sm text-amber-800">
              <strong>{{ t('zakat.calculated_nisab') }}:</strong> {{ formatCurrency(computedNisabValue) }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">{{ t('zakat.rate') }} (%)</label>
              <input 
                v-model.number="settingsForm.zakatRate" 
                type="number" 
                step="0.1"
                class="input"
              />
            </div>
            <div>
              <label class="label">{{ t('zakat.hawl_start') }}</label>
              <input 
                v-model="settingsForm.hawlStartDate" 
                type="date"
                class="input"
              />
            </div>
          </div>
        </div>

        <!-- Manual Asset Inputs -->
        <div class="space-y-4 border-t pt-6">
          <h3 class="font-medium text-gray-900 flex items-center gap-2">
            <Icon name="lucide:wallet" class="h-4 w-4" />
            {{ t('zakat.manual_assets') }}
          </h3>
          <p class="text-xs text-gray-500">{{ t('zakat.manual_assets_desc') }}</p>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">{{ t('zakat.cash_balance') }}</label>
              <input 
                v-model.number="settingsForm.cashBalance" 
                type="number" 
                step="0.01"
                class="input"
              />
            </div>
            <div>
              <label class="label">{{ t('zakat.receivables') }}</label>
              <input 
                v-model.number="settingsForm.receivables" 
                type="number" 
                step="0.01"
                class="input"
              />
            </div>
            <div>
              <label class="label">{{ t('zakat.other_assets') }}</label>
              <input 
                v-model.number="settingsForm.otherAssets" 
                type="number" 
                step="0.01"
                class="input"
              />
            </div>
            <div>
              <label class="label">{{ t('zakat.short_term_liabilities') }}</label>
              <input 
                v-model.number="settingsForm.shortTermLiabilities" 
                type="number" 
                step="0.01"
                class="input"
              />
            </div>
          </div>
        </div>
      </form>

      <template #footer>
        <button type="button" class="btn-secondary" @click="showSettingsModal = false">
          {{ t('app.cancel') }}
        </button>
        <button 
          type="submit" 
          class="btn-primary" 
          :disabled="isSaving"
          @click="saveSettings"
        >
          <Icon v-if="isSaving" name="lucide:loader-2" class="h-4 w-4 animate-spin" />
          {{ t('app.save') }}
        </button>
      </template>
    </UiModal>

    <!-- Pay Modal -->
    <UiModal v-model:open="showPayModal" :title="t('zakat.mark_paid')" size="md">
      <form @submit.prevent="markAsPaid" class="space-y-4">
        <div>
          <label class="label">{{ t('zakat.paid_amount') }}</label>
          <input 
            v-model.number="paymentForm.paidAmount" 
            type="number" 
            step="0.01"
            class="input"
            required
          />
        </div>

        <div>
          <label class="label">{{ t('zakat.payment_method') }}</label>
          <select v-model="paymentForm.paymentMethod" class="input">
            <option value="">{{ t('app.select') }}</option>
            <option v-for="method in paymentMethods" :key="method.value" :value="method.value">
              {{ method.label }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">{{ t('zakat.payment_reference') }}</label>
          <input 
            v-model="paymentForm.paymentReference" 
            type="text"
            class="input"
            :placeholder="t('zakat.receipt_number')"
          />
        </div>

        <div>
          <label class="label">{{ t('zakat.notes') }}</label>
          <textarea 
            v-model="paymentForm.notes" 
            class="input min-h-[80px]"
          />
        </div>
      </form>

      <template #footer>
        <button type="button" class="btn-secondary" @click="showPayModal = false">
          {{ t('app.cancel') }}
        </button>
        <button 
          type="submit" 
          class="btn-primary" 
          :disabled="isSaving"
          @click="markAsPaid"
        >
          <Icon v-if="isSaving" name="lucide:loader-2" class="h-4 w-4 animate-spin" />
          <Icon v-else name="lucide:check" class="h-4 w-4" />
          {{ t('zakat.confirm_payment') }}
        </button>
      </template>
    </UiModal>
  </div>
</template>
