<script setup lang="ts">
import { useCartStore } from '~/stores/cart';
const { t } = useI18n();
const router = useRouter();
const cart = useCartStore();
const { formatPrice } = useShopPrice();

onMounted(() => {
  cart.load();
  // Nothing to order: back to the catalog
  if (cart.isEmpty) router.replace('/shop');
});

const name = ref('');
const phone = ref('');
const note = ref('');
const honeypot = ref(''); // hidden from humans, bots fill it
const submitting = ref(false);
const fieldErrors = ref<{ name?: string; phone?: string }>({});
const serverError = ref('');

function validate(): boolean {
  fieldErrors.value = {};
  if (name.value.trim().length < 2) {
    fieldErrors.value.name = t('store.checkout.errors.name');
  }
  const digits = phone.value.replace(/[\s\-().+]/g, '');
  if (!/^\d{8,15}$/.test(digits)) {
    fieldErrors.value.phone = t('store.checkout.errors.phone');
  }
  return Object.keys(fieldErrors.value).length === 0;
}

async function submitOrder() {
  serverError.value = '';
  if (!validate()) return;
  submitting.value = true;
  try {
    const res = await $fetch('/api/shop/orders', {
      method: 'POST',
      body: {
        name: name.value.trim(),
        phone: phone.value.trim(),
        note: note.value.trim() || undefined,
        website: honeypot.value || undefined,
        items: cart.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
      },
    });
    cart.clear();
    await router.push(`/order/${res.orderNumber}`);
  } catch (e: any) {
    if (e?.statusCode === 409) {
      serverError.value = t('store.checkout.errors.stock');
    } else {
      serverError.value = e?.data?.message || t('store.checkout.errors.generic');
    }
  } finally {
    submitting.value = false;
  }
}

useSeoMeta({
  title: () => t('store.checkout.title'),
  robots: 'noindex',
});
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-10 font-store sm:px-6">
    <h1 class="font-display text-3xl font-bold tracking-tight text-ink">
      {{ t('store.checkout.title') }}
    </h1>
    <p class="mt-1 text-sm text-gray-500">{{ t('store.checkout.subtitle') }}</p>

    <div class="mt-8 grid gap-10 lg:grid-cols-3">
      <!-- Contact form -->
      <form class="space-y-5 lg:col-span-2" novalidate @submit.prevent="submitOrder">
        <div>
          <label for="co-name" class="mb-1.5 block text-sm font-medium text-ink">
            {{ t('store.checkout.name') }} <span class="text-red-500">*</span>
          </label>
          <input
            id="co-name"
            v-model="name"
            type="text"
            name="name"
            autocomplete="name"
            required
            class="h-11 w-full rounded-xl border px-4 text-sm focus:outline-none focus:ring-2"
            :class="
              fieldErrors.name
                ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                : 'border-gray-200 focus:border-cobalt-400 focus:ring-cobalt-100'
            "
            :aria-invalid="!!fieldErrors.name"
            :aria-describedby="fieldErrors.name ? 'co-name-error' : undefined"
          >
          <p v-if="fieldErrors.name" id="co-name-error" class="mt-1 text-xs text-red-600">
            {{ fieldErrors.name }}
          </p>
        </div>

        <div>
          <label for="co-phone" class="mb-1.5 block text-sm font-medium text-ink">
            {{ t('store.checkout.phone') }} <span class="text-red-500">*</span>
          </label>
          <input
            id="co-phone"
            v-model="phone"
            type="tel"
            name="phone"
            autocomplete="tel"
            required
            dir="ltr"
            placeholder="0555 12 34 56"
            class="h-11 w-full rounded-xl border px-4 text-sm focus:outline-none focus:ring-2 ltr:text-left rtl:text-right"
            :class="
              fieldErrors.phone
                ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                : 'border-gray-200 focus:border-cobalt-400 focus:ring-cobalt-100'
            "
            :aria-invalid="!!fieldErrors.phone"
            :aria-describedby="fieldErrors.phone ? 'co-phone-error' : 'co-phone-help'"
          >
          <p v-if="fieldErrors.phone" id="co-phone-error" class="mt-1 text-xs text-red-600">
            {{ fieldErrors.phone }}
          </p>
          <p v-else id="co-phone-help" class="mt-1 text-xs text-gray-400">
            {{ t('store.checkout.phoneHelp') }}
          </p>
        </div>

        <div>
          <label for="co-note" class="mb-1.5 block text-sm font-medium text-ink">
            {{ t('store.checkout.note') }}
            <span class="font-normal text-gray-400">({{ t('store.checkout.optional') }})</span>
          </label>
          <textarea
            id="co-note"
            v-model="note"
            name="note"
            rows="3"
            maxlength="500"
            class="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-cobalt-400 focus:outline-none focus:ring-2 focus:ring-cobalt-100"
            :placeholder="t('store.checkout.notePlaceholder')"
          />
        </div>

        <!-- Honeypot: invisible to humans -->
        <div class="absolute h-0 w-0 overflow-hidden" aria-hidden="true">
          <label for="co-website">Website</label>
          <input id="co-website" v-model="honeypot" type="text" name="website" tabindex="-1" autocomplete="off">
        </div>

        <div
          v-if="serverError"
          class="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          <Icon name="lucide:alert-circle" class="mt-0.5 h-4 w-4 shrink-0" />
          {{ serverError }}
        </div>

        <button
          type="submit"
          class="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-white transition-all hover:bg-cobalt-600 active:scale-[0.99] disabled:opacity-50 sm:w-auto sm:px-10"
          :disabled="submitting || cart.isEmpty"
        >
          <Icon v-if="submitting" name="lucide:loader-2" class="h-4 w-4 animate-spin" />
          {{ t('store.checkout.placeOrder') }}
        </button>
        <p class="text-xs text-gray-400">{{ t('store.checkout.paymentNote') }}</p>
      </form>

      <!-- Order summary -->
      <aside class="h-fit rounded-3xl bg-gray-50 p-6">
        <h2 class="font-display text-lg font-semibold text-ink">
          {{ t('store.checkout.yourOrder') }}
        </h2>
        <ul class="mt-4 space-y-3">
          <li
            v-for="item in cart.items"
            :key="`${item.productId}-${item.variantId}`"
            class="flex items-center justify-between gap-3 text-sm"
          >
            <span class="min-w-0 truncate text-gray-600">
              {{ item.quantity }}× {{ item.name }}
              <span v-if="item.variantName" class="text-gray-400">· {{ item.variantName }}</span>
            </span>
            <span class="shrink-0 font-medium text-ink">
              {{ formatPrice(item.price * item.quantity) }}
            </span>
          </li>
        </ul>
        <div class="mt-4 flex justify-between border-t border-gray-200 pt-3 text-base font-semibold text-ink">
          <span>{{ t('store.cart.total') }}</span>
          <span class="font-display">{{ formatPrice(cart.total) }}</span>
        </div>
      </aside>
    </div>
  </div>
</template>
