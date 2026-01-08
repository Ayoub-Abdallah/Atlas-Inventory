<script setup lang="ts">
import type { Tax } from '~~/server/database/schema';

const { t } = useI18n();
const toast = useToast();

// Fetch taxes
const { data: taxes, pending, refresh } = await useFetch('/api/taxes');

// Modal state
const isModalOpen = ref(false);
const editingTax = ref<Tax | null>(null);

// Form state
const form = reactive({
  name: '',
  rate: 20,
  isDefault: false,
});

// Table columns
const columns = computed(() => [
  { key: 'name', label: t('taxes.tax_name') },
  { key: 'rate', label: t('taxes.tax_rate'), class: 'text-right' },
  { key: 'default', label: t('taxes.is_default') },
  { key: 'actions', label: '', class: 'w-20' },
]);

function openCreateModal() {
  editingTax.value = null;
  resetForm();
  isModalOpen.value = true;
}

function openEditModal(tax: Tax) {
  editingTax.value = tax;
  Object.assign(form, {
    name: tax.name,
    rate: tax.rate * 100,
    isDefault: tax.isDefault ?? false,
  });
  isModalOpen.value = true;
}

function resetForm() {
  Object.assign(form, {
    name: '',
    rate: 20,
    isDefault: false,
  });
}

async function saveTax() {
  try {
    const payload = {
      ...form,
      rate: form.rate / 100,
    };

    if (editingTax.value) {
      await $fetch(`/api/taxes/${editingTax.value.id}`, {
        method: 'PUT',
        body: payload,
      });
      toast.success(t('taxes.tax_updated'));
    } else {
      await $fetch('/api/taxes', {
        method: 'POST',
        body: payload,
      });
      toast.success(t('taxes.tax_created'));
    }
    isModalOpen.value = false;
    refresh();
  } catch (error) {
    toast.error(t('errors.generic'));
    console.error('Failed to save tax:', error);
  }
}

async function deleteTax(id: string) {
  if (!confirm(t('taxes.confirm_delete'))) return;

  try {
    await $fetch(`/api/taxes/${id}`, { method: 'DELETE' });
    toast.success(t('taxes.tax_deleted'));
    refresh();
  } catch (error) {
    toast.error(t('errors.generic'));
    console.error('Failed to delete tax:', error);
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-gray-900">{{ t('taxes.title') }}</h1>
        <p class="text-xs text-gray-500">{{ t('taxes.description') }}</p>
      </div>
      <button class="btn-primary" @click="openCreateModal">
        <Icon name="lucide:plus" class="h-3.5 w-3.5" />
        {{ t('app.add') }}
      </button>
    </div>

    <!-- Taxes Table -->
    <div class="card overflow-hidden">
      <UiDataTable
        :columns="columns"
        :data="taxes || []"
        :loading="pending"
        :empty-title="t('taxes.no_taxes')"
        :empty-description="t('taxes.no_taxes_description')"
      >
        <template #name="{ item }">
          <p class="text-xs font-medium text-gray-900">{{ item.name }}</p>
        </template>

        <template #rate="{ item }">
          <span class="font-mono text-xs font-medium tabular-nums"
            >{{ (item.rate * 100).toFixed(1) }}%</span
          >
        </template>

        <template #default="{ item }">
          <span v-if="item.isDefault" class="badge badge-success">
            {{ t('taxes.is_default') }}
          </span>
          <span v-else class="text-gray-400">—</span>
        </template>

        <template #actions="{ item }">
          <div
            class="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <button
              class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              @click="openEditModal(item)"
              aria-label="Edit"
            >
              <Icon name="lucide:pencil" class="h-3.5 w-3.5" />
            </button>
            <button
              class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              @click="deleteTax(item.id)"
              aria-label="Delete"
            >
              <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
            </button>
          </div>
        </template>
      </UiDataTable>
    </div>

    <!-- Create/Edit Modal -->
    <UiModal
      v-model:open="isModalOpen"
      :title="editingTax ? t('taxes.edit_tax') : t('taxes.add_tax')"
    >
      <form id="tax-form" class="space-y-4" @submit.prevent="saveTax">
        <div>
          <label class="label">{{ t('taxes.tax_name') }} <span class="text-red-500">*</span></label>
          <UiInput v-model="form.name" :placeholder="t('taxes.tax_name')" autofocus />
        </div>

        <div>
          <label class="label">{{ t('taxes.tax_rate') }}</label>
          <UiInput
            v-model.number="form.rate"
            type="number"
            step="0.1"
            min="0"
            max="100"
          />
        </div>

        <div class="flex items-center gap-2">
          <input
            id="isDefault"
            v-model="form.isDefault"
            type="checkbox"
            class="h-4 w-4 rounded border-gray-300"
          />
          <label for="isDefault" class="text-xs text-gray-600">{{ t('taxes.is_default') }}</label>
        </div>
      </form>

      <template #footer>
        <button
          type="button"
          class="btn-secondary"
          @click="isModalOpen = false"
        >
          {{ t('app.cancel') }}
        </button>
        <button type="submit" form="tax-form" class="btn-primary">
          {{ editingTax ? t('app.save') : t('app.create') }}
        </button>
      </template>
    </UiModal>
  </div>
</template>
