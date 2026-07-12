<script setup lang="ts">
definePageMeta({ layout: 'admin' });

const { t } = useI18n();
const toast = useToast();
const { currencySymbol } = useSettings();
const { canEdit } = useAuth();

const statusFilter = ref<string>('');
const { data, refresh, pending } = await useFetch('/api/orders', {
  query: computed(() => (statusFilter.value ? { status: statusFilter.value } : {})),
});

const orders = computed(() => data.value?.orders || []);
const counts = computed(() => data.value?.counts || { new: 0, confirmed: 0, delivered: 0, cancelled: 0 });
const totalCount = computed(
  () => counts.value.new + counts.value.confirmed + counts.value.delivered + counts.value.cancelled
);

const tabs = computed(() => [
  { key: '', label: t('orders.tabs.all'), count: totalCount.value },
  { key: 'new', label: t('orders.status.new'), count: counts.value.new },
  { key: 'confirmed', label: t('orders.status.confirmed'), count: counts.value.confirmed },
  { key: 'delivered', label: t('orders.status.delivered'), count: counts.value.delivered },
  { key: 'cancelled', label: t('orders.status.cancelled'), count: counts.value.cancelled },
]);

const statusStyles: Record<string, string> = {
  new: 'bg-cobalt-50 text-cobalt-700',
  confirmed: 'bg-warning-muted text-warning',
  delivered: 'bg-success-muted text-success',
  cancelled: 'bg-gray-100 text-gray-500',
};

const selectedOrder = ref<(typeof orders.value)[number] | null>(null);
const actionLoading = ref(false);

function fmt(n: number | null | undefined) {
  return `${(n ?? 0).toLocaleString()} ${currencySymbol.value}`;
}

function fmtDate(d: string | Date | null) {
  if (!d) return '';
  return new Date(d).toLocaleString();
}

function waMessage(order: { customerName: string; orderNumber: string }) {
  return t('orders.whatsapp.message', {
    name: order.customerName,
    number: order.orderNumber,
  });
}

async function setStatus(order: { id: string }, status: string) {
  actionLoading.value = true;
  try {
    await $fetch(`/api/orders/${order.id}/status`, {
      method: 'PUT',
      body: { status },
    });
    toast.success(t(`orders.actions.${status}Done`));
    selectedOrder.value = null;
    await refresh();
  } catch (e: any) {
    if (e?.data?.data?.items) {
      const lines = e.data.data.items
        .map((i: any) => `${i.productName}: ${i.available}/${i.requested}`)
        .join(', ');
      toast.error(t('orders.errors.insufficientStock'), lines);
    } else {
      toast.error(e?.data?.message || t('orders.errors.generic'));
    }
  } finally {
    actionLoading.value = false;
  }
}

async function convertToSale(order: { id: string }) {
  actionLoading.value = true;
  try {
    const res = await $fetch(`/api/orders/${order.id}/convert`, { method: 'POST' });
    toast.success(t('orders.actions.converted'));
    selectedOrder.value = null;
    await refresh();
    await navigateTo(`/admin/sales/${res.saleId}`);
  } catch (e: any) {
    toast.error(e?.data?.message || t('orders.errors.generic'));
  } finally {
    actionLoading.value = false;
  }
}

useHead({ title: t('orders.title') });
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">{{ t('orders.title') }}</h1>
        <p class="mt-1 text-sm text-gray-500">{{ t('orders.subtitle') }}</p>
      </div>
      <UiButton variant="outline" size="sm" :disabled="pending" @click="refresh()">
        <Icon name="lucide:refresh-cw" class="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" :class="pending ? 'animate-spin' : ''" />
        {{ t('app.refresh') }}
      </UiButton>
    </div>

    <!-- Status tabs -->
    <div class="flex flex-wrap gap-2" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        role="tab"
        :aria-selected="statusFilter === tab.key"
        class="flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors"
        :class="
          statusFilter === tab.key
            ? 'border-primary-600 bg-primary-600 text-white'
            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
        "
        @click="statusFilter = tab.key"
      >
        {{ tab.label }}
        <span
          class="rounded-full px-1.5 text-xs"
          :class="statusFilter === tab.key ? 'bg-white/20' : 'bg-gray-100'"
        >
          {{ tab.count }}
        </span>
      </button>
    </div>

    <!-- Orders table -->
    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-100 bg-gray-50/60 text-xs uppercase tracking-wide text-gray-500">
              <th class="px-4 py-3 font-medium ltr:text-left rtl:text-right">{{ t('orders.table.number') }}</th>
              <th class="px-4 py-3 font-medium ltr:text-left rtl:text-right">{{ t('orders.table.customer') }}</th>
              <th class="hidden px-4 py-3 font-medium md:table-cell ltr:text-left rtl:text-right">{{ t('orders.table.items') }}</th>
              <th class="px-4 py-3 font-medium ltr:text-right rtl:text-left">{{ t('orders.table.total') }}</th>
              <th class="px-4 py-3 font-medium ltr:text-left rtl:text-right">{{ t('orders.table.status') }}</th>
              <th class="hidden px-4 py-3 font-medium lg:table-cell ltr:text-left rtl:text-right">{{ t('orders.table.date') }}</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="order in orders"
              :key="order.id"
              class="cursor-pointer border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50/60"
              @click="selectedOrder = order"
            >
              <td class="px-4 py-3 font-mono text-xs font-semibold text-gray-900">
                {{ order.orderNumber }}
              </td>
              <td class="px-4 py-3">
                <div class="font-medium text-gray-900">{{ order.customerName }}</div>
                <div class="text-xs text-gray-500" dir="ltr">{{ order.phone }}</div>
              </td>
              <td class="hidden max-w-56 truncate px-4 py-3 text-gray-600 md:table-cell">
                {{ order.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ') }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 font-semibold text-gray-900 ltr:text-right rtl:text-left">
                {{ fmt(order.totalAmount) }}
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                  :class="statusStyles[order.status]"
                >
                  {{ t(`orders.status.${order.status}`) }}
                </span>
                <span
                  v-if="order.saleId"
                  class="ltr:ml-1 rtl:mr-1 inline-flex rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700"
                >
                  {{ t('orders.convertedBadge') }}
                </span>
              </td>
              <td class="hidden whitespace-nowrap px-4 py-3 text-xs text-gray-500 lg:table-cell">
                {{ fmtDate(order.createdAt) }}
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-1.5">
                  <AdminWhatsAppButton :phone="order.phone" :message="waMessage(order)" />
                  <UiButton
                    v-if="order.status === 'new' && canEdit"
                    size="sm"
                    :loading="actionLoading"
                    @click.stop="setStatus(order, 'confirmed')"
                  >
                    {{ t('orders.actions.confirm') }}
                  </UiButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty state -->
      <UiEmptyState
        v-if="!pending && orders.length === 0"
        :title="t('orders.empty.title')"
        :description="t('orders.empty.description')"
      />

      <!-- Loading skeleton -->
      <div v-if="pending && orders.length === 0" class="space-y-2 p-4">
        <div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100" />
      </div>
    </div>

    <!-- Detail modal -->
    <UiModal
      :open="!!selectedOrder"
      :title="selectedOrder ? `${t('orders.detail.title')} ${selectedOrder.orderNumber}` : ''"
      size="lg"
      @close="selectedOrder = null"
    >
      <div v-if="selectedOrder" class="space-y-5">
        <!-- Customer -->
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-4">
          <div>
            <p class="font-semibold text-gray-900">{{ selectedOrder.customerName }}</p>
            <p class="text-sm text-gray-500" dir="ltr">{{ selectedOrder.phone }}</p>
            <p v-if="selectedOrder.note" class="mt-1 text-sm italic text-gray-600">
              «{{ selectedOrder.note }}»
            </p>
          </div>
          <AdminWhatsAppButton
            :phone="selectedOrder.phone"
            :message="waMessage(selectedOrder)"
            size="md"
            label
          />
        </div>

        <!-- Items -->
        <div class="overflow-hidden rounded-xl border border-gray-100">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50/60 text-xs uppercase text-gray-500">
                <th class="px-3 py-2 font-medium ltr:text-left rtl:text-right">{{ t('orders.table.product') }}</th>
                <th class="px-3 py-2 font-medium ltr:text-right rtl:text-left">{{ t('orders.table.qty') }}</th>
                <th class="px-3 py-2 font-medium ltr:text-right rtl:text-left">{{ t('orders.table.price') }}</th>
                <th class="px-3 py-2 font-medium ltr:text-right rtl:text-left">{{ t('orders.table.lineTotal') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in selectedOrder.items" :key="item.id" class="border-t border-gray-50">
                <td class="px-3 py-2">
                  {{ item.productName }}
                  <span v-if="item.variantName" class="text-gray-500">· {{ item.variantName }}</span>
                </td>
                <td class="px-3 py-2 ltr:text-right rtl:text-left">{{ item.quantity }}</td>
                <td class="px-3 py-2 ltr:text-right rtl:text-left">{{ fmt(item.unitPrice) }}</td>
                <td class="px-3 py-2 font-medium ltr:text-right rtl:text-left">{{ fmt(item.lineTotal) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="border-t border-gray-100 bg-gray-50/60">
                <td colspan="3" class="px-3 py-2 font-semibold ltr:text-right rtl:text-left">
                  {{ t('orders.table.total') }}
                </td>
                <td class="px-3 py-2 font-bold ltr:text-right rtl:text-left">
                  {{ fmt(selectedOrder.totalAmount) }}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Actions -->
        <div v-if="canEdit" class="flex flex-wrap items-center justify-end gap-2">
          <template v-if="!selectedOrder.saleId">
            <UiButton
              v-if="selectedOrder.status === 'new'"
              variant="outline"
              :loading="actionLoading"
              @click="setStatus(selectedOrder, 'cancelled')"
            >
              {{ t('orders.actions.cancel') }}
            </UiButton>
            <UiButton
              v-if="selectedOrder.status === 'confirmed'"
              variant="outline"
              :loading="actionLoading"
              @click="setStatus(selectedOrder, 'cancelled')"
            >
              {{ t('orders.actions.cancelRestock') }}
            </UiButton>
            <UiButton
              v-if="selectedOrder.status === 'new'"
              :loading="actionLoading"
              @click="setStatus(selectedOrder, 'confirmed')"
            >
              {{ t('orders.actions.confirm') }}
            </UiButton>
            <UiButton
              v-if="selectedOrder.status === 'confirmed'"
              :loading="actionLoading"
              @click="setStatus(selectedOrder, 'delivered')"
            >
              {{ t('orders.actions.deliver') }}
            </UiButton>
            <UiButton
              v-if="['confirmed', 'delivered'].includes(selectedOrder.status)"
              variant="secondary"
              :loading="actionLoading"
              @click="convertToSale(selectedOrder)"
            >
              <Icon name="lucide:receipt" class="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
              {{ t('orders.actions.convert') }}
            </UiButton>
          </template>
          <NuxtLink v-else :to="`/admin/sales/${selectedOrder.saleId}`">
            <UiButton variant="secondary">
              <Icon name="lucide:receipt" class="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
              {{ t('orders.actions.viewSale') }}
            </UiButton>
          </NuxtLink>
        </div>
      </div>
    </UiModal>
  </div>
</template>
