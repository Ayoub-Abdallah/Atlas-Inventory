<script setup lang="ts">
import { useCartStore } from '~/stores/cart';
const { t } = useI18n();
const cart = useCartStore();
const { formatPrice } = useShopPrice();

onMounted(() => cart.load());

useSeoMeta({
  title: () => t('store.cart.title'),
  robots: 'noindex',
});
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-10 font-store sm:px-6">
    <h1 class="font-display text-3xl font-bold tracking-tight text-ink">
      {{ t('store.cart.title') }}
    </h1>

    <!-- Empty cart -->
    <div v-if="cart.isEmpty" class="flex flex-col items-center gap-4 py-20 text-center">
      <div class="flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
        <Icon name="lucide:shopping-bag" class="h-7 w-7 text-gray-300" />
      </div>
      <p class="font-display text-lg font-semibold text-ink">{{ t('store.cart.emptyTitle') }}</p>
      <p class="max-w-sm text-sm text-gray-500">{{ t('store.cart.emptyDescription') }}</p>
      <NuxtLink
        to="/shop"
        class="mt-2 rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cobalt-600"
      >
        {{ t('store.cart.browse') }}
      </NuxtLink>
    </div>

    <div v-else class="mt-8 grid gap-10 lg:grid-cols-3">
      <!-- Items -->
      <ul class="space-y-4 lg:col-span-2">
        <li
          v-for="item in cart.items"
          :key="`${item.productId}-${item.variantId}`"
          class="flex gap-4 rounded-3xl border border-gray-100 p-4"
        >
          <NuxtLink
            :to="`/product/${item.slug}`"
            class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl p-2"
            :class="tileClassFor(item.productId)"
          >
            <img
              v-if="item.image"
              :src="item.image"
              :alt="item.name"
              loading="lazy"
              class="h-full w-full object-contain"
            >
            <Icon v-else name="lucide:smartphone" class="h-7 w-7 text-gray-400" />
          </NuxtLink>

          <div class="flex min-w-0 flex-1 flex-col">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <NuxtLink
                  :to="`/product/${item.slug}`"
                  class="line-clamp-1 text-sm font-medium text-ink hover:text-cobalt-600"
                >
                  {{ item.name }}
                </NuxtLink>
                <p v-if="item.variantName" class="text-xs text-gray-500">{{ item.variantName }}</p>
              </div>
              <button
                type="button"
                class="rounded-md p-1 text-gray-300 transition-colors hover:text-red-500"
                :aria-label="`${t('store.cart.remove')}: ${item.name}`"
                @click="cart.remove(item.productId, item.variantId)"
              >
                <Icon name="lucide:x" class="h-4 w-4" />
              </button>
            </div>

            <div class="mt-auto flex items-center justify-between pt-3">
              <StoreQuantityStepper
                :model-value="item.quantity"
                :max="Math.min(item.maxQuantity || 99, 99)"
                @update:model-value="(v) => cart.setQuantity(item.productId, item.variantId, v)"
              />
              <p class="font-display text-sm font-semibold text-ink">
                {{ formatPrice(item.price * item.quantity) }}
              </p>
            </div>
          </div>
        </li>
      </ul>

      <!-- Summary -->
      <aside class="h-fit rounded-3xl bg-gray-50 p-6">
        <h2 class="font-display text-lg font-semibold text-ink">
          {{ t('store.cart.summary') }}
        </h2>
        <dl class="mt-4 space-y-2 text-sm">
          <div class="flex justify-between text-gray-600">
            <dt>{{ t('store.cart.itemCount', { count: cart.count }) }}</dt>
            <dd>{{ formatPrice(cart.total) }}</dd>
          </div>
          <div class="flex justify-between border-t border-gray-200 pt-3 text-base font-semibold text-ink">
            <dt>{{ t('store.cart.total') }}</dt>
            <dd class="font-display">{{ formatPrice(cart.total) }}</dd>
          </div>
        </dl>
        <p class="mt-2 text-xs text-gray-400">{{ t('store.cart.paymentNote') }}</p>
        <NuxtLink
          to="/checkout"
          class="mt-5 flex h-11 w-full items-center justify-center rounded-full bg-ink text-sm font-semibold text-white transition-colors hover:bg-cobalt-600"
        >
          {{ t('store.cart.checkout') }}
        </NuxtLink>
        <NuxtLink
          to="/shop"
          class="mt-2 flex h-11 w-full items-center justify-center rounded-full text-sm font-medium text-gray-600 transition-colors hover:text-ink"
        >
          {{ t('store.cart.continue') }}
        </NuxtLink>
      </aside>
    </div>
  </div>
</template>
