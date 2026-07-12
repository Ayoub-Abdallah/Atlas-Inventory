<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
const { formatPrice } = useShopPrice();

const number = route.params.number as string;
const { data: order, error } = await useFetch(`/api/shop/orders/${number}`, {
  key: `order-${number}`,
});

if (error.value || !order.value) {
  throw createError({ statusCode: 404, message: 'Order not found', fatal: true });
}

useSeoMeta({
  title: () => `${t('store.order.title')} ${number}`,
  robots: 'noindex',
});
</script>

<template>
  <div v-if="order" class="mx-auto max-w-2xl px-4 py-12 font-store sm:px-6">
    <!-- Success header -->
    <div class="flex flex-col items-center text-center">
      <div class="flex h-16 w-16 items-center justify-center rounded-full bg-success-muted">
        <Icon name="lucide:check" class="h-8 w-8 text-success" />
      </div>
      <h1 class="mt-4 font-display text-2xl font-bold tracking-tight text-ink">
        {{ t('store.order.thanks', { name: order.customerName }) }}
      </h1>
      <p class="mt-2 max-w-md text-sm leading-relaxed text-gray-500">
        {{ t('store.order.confirmation') }}
      </p>
      <p class="mt-4 rounded-full bg-gray-50 px-4 py-2 font-mono text-sm font-semibold text-ink">
        {{ order.orderNumber }}
      </p>
    </div>

    <!-- Order recap -->
    <div class="mt-10 overflow-hidden rounded-3xl border border-gray-100">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-gray-50/60 text-xs uppercase tracking-wide text-gray-500">
            <th class="px-4 py-3 font-medium ltr:text-left rtl:text-right">{{ t('store.order.product') }}</th>
            <th class="px-4 py-3 font-medium ltr:text-right rtl:text-left">{{ t('store.order.qty') }}</th>
            <th class="px-4 py-3 font-medium ltr:text-right rtl:text-left">{{ t('store.order.subtotal') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, i) in order.items" :key="i" class="border-t border-gray-50">
            <td class="px-4 py-3 text-ink">
              {{ item.productName }}
              <span v-if="item.variantName" class="text-gray-400">· {{ item.variantName }}</span>
            </td>
            <td class="px-4 py-3 ltr:text-right rtl:text-left">{{ item.quantity }}</td>
            <td class="px-4 py-3 font-medium ltr:text-right rtl:text-left">
              {{ formatPrice(item.lineTotal) }}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t border-gray-100 bg-gray-50/60">
            <td colspan="2" class="px-4 py-3 font-semibold text-ink ltr:text-right rtl:text-left">
              {{ t('store.cart.total') }}
            </td>
            <td class="px-4 py-3 font-display font-bold text-ink ltr:text-right rtl:text-left">
              {{ formatPrice(order.totalAmount) }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="mt-8 flex justify-center">
      <NuxtLink
        to="/shop"
        class="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cobalt-600"
      >
        {{ t('store.cart.continue') }}
      </NuxtLink>
    </div>
  </div>
</template>
