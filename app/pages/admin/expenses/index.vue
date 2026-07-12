<script setup lang="ts">
import type { Expense, ExpenseCategory } from '~~/server/database/schema';

const { t, locale } = useI18n();
const toast = useToast();

// Date range filter
const dateRange = ref('30d');
const customFrom = ref('');
const customTo = ref('');

// Calculate date range
const dateParams = computed(() => {
  const now = new Date();
  let from: Date;
  let to = now;

  switch (dateRange.value) {
    case 'today':
      from = new Date();
      from.setHours(0, 0, 0, 0);
      break;
    case '7d':
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
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

// Fetch expenses
const { data: expenses, pending, refresh } = await useFetch('/api/expenses', {
  query: dateParams,
});

// Fetch expense categories
const { data: categories, refresh: refreshCategories } = await useFetch('/api/expenses/categories');

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

// Expense modal state
const isExpenseModalOpen = ref(false);
const editingExpense = ref<Expense | null>(null);
const expenseForm = reactive({
  categoryId: '',
  description: '',
  amount: 0,
  date: new Date().toISOString().split('T')[0],
  paymentMethod: 'cash',
  reference: '',
  notes: '',
  isRecurring: false,
});
const isSubmitting = ref(false);

// Category modal state
const isCategoryModalOpen = ref(false);
const editingCategory = ref<ExpenseCategory | null>(null);
const categoryForm = reactive({
  name: '',
  description: '',
  color: '#6B7280',
});

// Active tab
const activeTab = ref<'expenses' | 'categories'>('expenses');

// Payment methods
const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile', label: 'Mobile Payment' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' },
];

// Color options for categories
const colorOptions = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#6B7280',
];

// Computed stats
const totalExpenses = computed(() => 
  expenses.value?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0
);

const expensesByCategory = computed(() => {
  const grouped: Record<string, { name: string; color: string; total: number; count: number }> = {};
  
  for (const expense of (expenses.value || [])) {
    const catId = expense.categoryId || 'uncategorized';
    const catName = expense.category?.name || 'Uncategorized';
    const catColor = expense.category?.color || '#6B7280';
    
    if (!grouped[catId]) {
      grouped[catId] = { name: catName, color: catColor, total: 0, count: 0 };
    }
    grouped[catId].total += expense.amount;
    grouped[catId].count += 1;
  }
  
  return Object.values(grouped).sort((a, b) => b.total - a.total);
});

function openExpenseModal(expense?: Expense) {
  if (expense) {
    editingExpense.value = expense;
    Object.assign(expenseForm, {
      categoryId: expense.categoryId || '',
      description: expense.description,
      amount: expense.amount,
      date: expense.date ? new Date(expense.date).toISOString().split('T')[0] : '',
      paymentMethod: expense.paymentMethod || 'cash',
      reference: expense.reference || '',
      notes: expense.notes || '',
      isRecurring: expense.isRecurring || false,
    });
  } else {
    editingExpense.value = null;
    Object.assign(expenseForm, {
      categoryId: '',
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'cash',
      reference: '',
      notes: '',
      isRecurring: false,
    });
  }
  isExpenseModalOpen.value = true;
}

async function saveExpense() {
  if (!expenseForm.description.trim()) {
    toast.warning('Please enter a description');
    return;
  }
  if (expenseForm.amount <= 0) {
    toast.warning('Please enter a valid amount');
    return;
  }

  isSubmitting.value = true;
  try {
    if (editingExpense.value) {
      await $fetch(`/api/expenses/${editingExpense.value.id}`, {
        method: 'PUT',
        body: expenseForm,
      });
      toast.success('Expense updated successfully');
    } else {
      await $fetch('/api/expenses', {
        method: 'POST',
        body: expenseForm,
      });
      toast.success('Expense added successfully');
    }
    isExpenseModalOpen.value = false;
    refresh();
  } catch (error) {
    console.error('Failed to save expense:', error);
    toast.error('Failed to save expense');
  } finally {
    isSubmitting.value = false;
  }
}

async function deleteExpense(id: string) {
  if (!confirm('Are you sure you want to delete this expense?')) return;

  try {
    await $fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    toast.success('Expense deleted');
    refresh();
  } catch (error) {
    console.error('Failed to delete expense:', error);
    toast.error('Failed to delete expense');
  }
}

function openCategoryModal(category?: ExpenseCategory) {
  if (category) {
    editingCategory.value = category;
    Object.assign(categoryForm, {
      name: category.name,
      description: category.description || '',
      color: category.color || '#6B7280',
    });
  } else {
    editingCategory.value = null;
    Object.assign(categoryForm, {
      name: '',
      description: '',
      color: '#6B7280',
    });
  }
  isCategoryModalOpen.value = true;
}

async function saveCategory() {
  if (!categoryForm.name.trim()) {
    toast.warning('Please enter a category name');
    return;
  }

  isSubmitting.value = true;
  try {
    if (editingCategory.value) {
      await $fetch(`/api/expenses/categories/${editingCategory.value.id}`, {
        method: 'PUT',
        body: categoryForm,
      });
      toast.success('Category updated');
    } else {
      await $fetch('/api/expenses/categories', {
        method: 'POST',
        body: categoryForm,
      });
      toast.success('Category added');
    }
    isCategoryModalOpen.value = false;
    refreshCategories();
  } catch (error) {
    console.error('Failed to save category:', error);
    toast.error('Failed to save category');
  } finally {
    isSubmitting.value = false;
  }
}

async function deleteCategory(id: string, name: string) {
  if (!confirm(`Delete category "${name}"?`)) return;

  try {
    await $fetch(`/api/expenses/categories/${id}`, { method: 'DELETE' });
    toast.success('Category deleted');
    refreshCategories();
  } catch (error: any) {
    console.error('Failed to delete category:', error);
    toast.error(error.data?.message || 'Failed to delete category');
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-gray-900">{{ t('expenses.title') }}</h1>
        <p class="text-xs text-gray-500">{{ t('expenses.description') }}</p>
      </div>
      <button class="btn-primary" @click="openExpenseModal()">
        <Icon name="lucide:plus" class="h-3.5 w-3.5" />
        {{ t('expenses.add_expense') }}
      </button>
    </div>

    <!-- Date Range Filter -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-1.5">
        <Icon name="lucide:calendar" class="h-3.5 w-3.5 text-gray-400" />
        <select
          v-model="dateRange"
          class="text-xs border-0 bg-transparent focus:ring-0 p-0"
          @change="refresh()"
        >
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="1y">Last year</option>
          <option value="custom">Custom range</option>
        </select>
      </div>
      
      <div v-if="dateRange === 'custom'" class="flex items-center gap-2">
        <input
          v-model="customFrom"
          type="date"
          class="text-xs border border-gray-200 rounded px-2 py-1.5"
          @change="refresh()"
        />
        <span class="text-gray-400">to</span>
        <input
          v-model="customTo"
          type="date"
          class="text-xs border border-gray-200 rounded px-2 py-1.5"
          @change="refresh()"
        />
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
            <Icon name="lucide:trending-down" class="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p class="text-xs text-gray-500">{{ t('expenses.total_expenses') }}</p>
            <p class="text-lg font-semibold text-gray-900">
              {{ formatCurrency(totalExpenses) }}
            </p>
          </div>
        </div>
      </div>

      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
            <Icon name="lucide:receipt" class="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p class="text-xs text-gray-500">{{ t('expenses.expense_count') }}</p>
            <p class="text-lg font-semibold text-gray-900">
              {{ expenses?.length || 0 }}
            </p>
          </div>
        </div>
      </div>

      <div class="card p-4 col-span-2">
        <p class="text-xs text-gray-500 mb-2">{{ t('expenses.by_category') }}</p>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="cat in expensesByCategory.slice(0, 5)"
            :key="cat.name"
            class="flex items-center gap-1.5 text-xs"
          >
            <span
              class="w-2 h-2 rounded-full"
              :style="{ backgroundColor: cat.color }"
            />
            <span class="text-gray-600">{{ cat.name }}:</span>
            <span class="font-medium">{{ formatCurrency(cat.total) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200">
      <nav class="flex gap-4">
        <button
          :class="[
            'pb-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'expenses'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          ]"
          @click="activeTab = 'expenses'"
        >
          {{ t('expenses.all_expenses') }}
        </button>
        <button
          :class="[
            'pb-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'categories'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          ]"
          @click="activeTab = 'categories'"
        >
          {{ t('expenses.categories') }}
        </button>
      </nav>
    </div>

    <!-- Expenses List -->
    <div v-if="activeTab === 'expenses'" class="card overflow-hidden">
      <div v-if="pending" class="flex justify-center py-8">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-gray-400" />
      </div>
      <table v-else class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              {{ t('expenses.date') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              {{ t('expenses.description') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              {{ t('expenses.category') }}
            </th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              {{ t('expenses.amount') }}
            </th>
            <th class="px-4 py-3 w-24"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          <tr
            v-for="expense in expenses"
            :key="expense.id"
            class="hover:bg-gray-50 group"
          >
            <td class="px-4 py-3 text-sm text-gray-600">
              {{ formatDate(expense.date) }}
            </td>
            <td class="px-4 py-3">
              <p class="text-sm font-medium text-gray-900">{{ expense.description }}</p>
              <p v-if="expense.reference" class="text-xs text-gray-500">
                Ref: {{ expense.reference }}
              </p>
            </td>
            <td class="px-4 py-3">
              <span
                v-if="expense.category"
                class="inline-flex items-center gap-1.5 text-xs"
              >
                <span
                  class="w-2 h-2 rounded-full"
                  :style="{ backgroundColor: expense.category.color }"
                />
                {{ expense.category.name }}
              </span>
              <span v-else class="text-xs text-gray-400">Uncategorized</span>
            </td>
            <td class="px-4 py-3 text-right">
              <span class="text-sm font-medium text-red-600">
                -{{ formatCurrency(expense.amount) }}
              </span>
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  @click="openExpenseModal(expense)"
                >
                  <Icon name="lucide:pencil" class="h-3.5 w-3.5" />
                </button>
                <button
                  class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  @click="deleteExpense(expense.id)"
                >
                  <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!expenses?.length">
            <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-500">
              {{ t('expenses.no_expenses') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Categories List -->
    <div v-if="activeTab === 'categories'" class="space-y-3">
      <div class="flex justify-end">
        <button class="btn-secondary text-sm" @click="openCategoryModal()">
          <Icon name="lucide:plus" class="h-3.5 w-3.5" />
          {{ t('expenses.add_category') }}
        </button>
      </div>
      
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="category in categories"
          :key="category.id"
          class="card p-4 hover:shadow-md transition-shadow group"
        >
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div
                class="w-4 h-4 rounded"
                :style="{ backgroundColor: category.color }"
              />
              <div>
                <p class="text-sm font-medium text-gray-900">{{ category.name }}</p>
                <p v-if="category.description" class="text-xs text-gray-500">
                  {{ category.description }}
                </p>
              </div>
            </div>
            <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                @click="openCategoryModal(category)"
              >
                <Icon name="lucide:pencil" class="h-3.5 w-3.5" />
              </button>
              <button
                class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                @click="deleteCategory(category.id, category.name)"
              >
                <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
        
        <div v-if="!categories?.length" class="col-span-full text-center py-8 text-sm text-gray-500">
          {{ t('expenses.no_categories') }}
        </div>
      </div>
    </div>

    <!-- Expense Modal -->
    <UiModal
      v-model:open="isExpenseModalOpen"
      :title="editingExpense ? t('expenses.edit_expense') : t('expenses.add_expense')"
      size="md"
    >
      <form id="expense-form" class="space-y-4" @submit.prevent="saveExpense">
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label class="label">{{ t('expenses.amount') }} <span class="text-red-500">*</span></label>
            <UiInput v-model.number="expenseForm.amount" type="number" step="0.01" min="0" />
          </div>
          <div>
            <label class="label">{{ t('expenses.date') }} <span class="text-red-500">*</span></label>
            <UiInput v-model="expenseForm.date" type="date" />
          </div>
        </div>

        <div>
          <label class="label">{{ t('expenses.description') }} <span class="text-red-500">*</span></label>
          <UiInput v-model="expenseForm.description" :placeholder="t('expenses.description_placeholder')" />
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label class="label">{{ t('expenses.category') }}</label>
            <select v-model="expenseForm.categoryId" class="input">
              <option value="">{{ t('expenses.no_category') }}</option>
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="label">{{ t('expenses.payment_method') }}</label>
            <select v-model="expenseForm.paymentMethod" class="input">
              <option v-for="method in paymentMethods" :key="method.value" :value="method.value">
                {{ method.label }}
              </option>
            </select>
          </div>
        </div>

        <div>
          <label class="label">{{ t('expenses.reference') }}</label>
          <UiInput v-model="expenseForm.reference" :placeholder="t('expenses.reference_placeholder')" />
        </div>

        <div>
          <label class="label">{{ t('expenses.notes') }}</label>
          <textarea
            v-model="expenseForm.notes"
            class="input min-h-[60px] resize-none"
            :placeholder="t('expenses.notes_placeholder')"
          />
        </div>

        <div class="flex items-center gap-2">
          <input
            id="isRecurring"
            v-model="expenseForm.isRecurring"
            type="checkbox"
            class="rounded border-gray-300"
          />
          <label for="isRecurring" class="text-sm text-gray-600">
            {{ t('expenses.recurring') }}
          </label>
        </div>
      </form>

      <template #footer>
        <button
          type="button"
          class="btn-secondary"
          :disabled="isSubmitting"
          @click="isExpenseModalOpen = false"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          type="submit"
          form="expense-form"
          class="btn-primary"
          :disabled="isSubmitting"
        >
          <Icon
            v-if="isSubmitting"
            name="lucide:loader-2"
            class="h-3.5 w-3.5 animate-spin"
          />
          {{ editingExpense ? t('common.update') : t('common.add') }}
        </button>
      </template>
    </UiModal>

    <!-- Category Modal -->
    <UiModal
      v-model:open="isCategoryModalOpen"
      :title="editingCategory ? t('expenses.edit_category') : t('expenses.add_category')"
      size="sm"
    >
      <form id="category-form" class="space-y-4" @submit.prevent="saveCategory">
        <div>
          <label class="label">{{ t('common.name') }} <span class="text-red-500">*</span></label>
          <UiInput v-model="categoryForm.name" :placeholder="t('expenses.category_name')" />
        </div>

        <div>
          <label class="label">{{ t('expenses.description') }}</label>
          <UiInput v-model="categoryForm.description" :placeholder="t('expenses.category_description')" />
        </div>

        <div>
          <label class="label">{{ t('expenses.color') }}</label>
          <div class="flex flex-wrap gap-2 mt-1">
            <button
              v-for="color in colorOptions"
              :key="color"
              type="button"
              class="w-6 h-6 rounded border-2 transition-all"
              :class="categoryForm.color === color ? 'border-gray-900 scale-110' : 'border-transparent'"
              :style="{ backgroundColor: color }"
              @click="categoryForm.color = color"
            />
          </div>
        </div>
      </form>

      <template #footer>
        <button
          type="button"
          class="btn-secondary"
          :disabled="isSubmitting"
          @click="isCategoryModalOpen = false"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          type="submit"
          form="category-form"
          class="btn-primary"
          :disabled="isSubmitting"
        >
          {{ editingCategory ? t('common.update') : t('common.add') }}
        </button>
      </template>
    </UiModal>
  </div>
</template>
