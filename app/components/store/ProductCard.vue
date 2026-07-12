<script setup lang="ts">
import { useCartStore } from '~/stores/cart';
interface CardProduct {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  price: number;
  priceFrom: boolean;
  inStock: boolean;
  stockQuantity: number;
  image: { url: string; alt: string | null } | null;
  category: { id: string; name: string; slug: string | null } | null;
}

const props = defineProps<{ product: CardProduct }>();

const { t } = useI18n();
const { formatPrice } = useShopPrice();
const cart = useCartStore();
const toast = useToast();

const tile = computed(() => tileClassFor(props.product.id));

function addToCart() {
  if (!props.product.inStock) return;
  cart.add({
    productId: props.product.id,
    variantId: null,
    slug: props.product.slug,
    name: props.product.name,
    variantName: null,
    price: props.product.price,
    image: props.product.image?.url || null,
    maxQuantity: props.product.stockQuantity,
  });
  toast.success(t('store.cart.added', { name: props.product.name }));
}
</script>

<template>
  <article class="group relative font-store">
    <NuxtLink
      :to="`/product/${product.slug}`"
      class="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt-400 focus-visible:ring-offset-2 rounded-3xl"
    >
      <!-- Pastel tile -->
      <div
        class="relative flex aspect-square items-center justify-center overflow-hidden rounded-3xl p-6 transition-shadow duration-300 group-hover:shadow-lg group-hover:shadow-gray-200/80"
        :class="tile"
      >
        <img
          v-if="product.image"
          :src="product.image.url"
          :alt="product.image.alt || product.name"
          loading="lazy"
          decoding="async"
          class="h-full w-full object-contain transition-transform duration-300 ease-out group-hover:scale-[1.05]"
          :class="!product.inStock ? 'opacity-50 saturate-50' : ''"
        >
        <div v-else class="flex flex-col items-center gap-2 text-gray-400">
          <Icon name="lucide:smartphone" class="h-10 w-10" />
        </div>

        <span
          v-if="!product.inStock"
          class="absolute top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-gray-600 ltr:left-3 rtl:right-3"
        >
          {{ t('store.product.outOfStock') }}
        </span>

        <!-- Quick add -->
        <button
          v-if="product.inStock"
          type="button"
          class="absolute bottom-3 flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white opacity-100 shadow-md transition-all duration-200 hover:bg-cobalt-600 active:scale-95 md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100 ltr:right-3 rtl:left-3"
          :aria-label="`${t('store.product.addToCart')}: ${product.name}`"
          @click.prevent="addToCart"
        >
          <Icon name="lucide:plus" class="h-5 w-5" />
        </button>
      </div>

      <!-- Text -->
      <div class="mt-3 px-1">
        <p v-if="product.brand" class="text-xs font-medium uppercase tracking-wide text-gray-400">
          {{ product.brand }}
        </p>
        <h3 class="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-ink">
          {{ product.name }}
        </h3>
        <p class="mt-1 font-display text-base font-semibold text-ink">
          <span v-if="product.priceFrom" class="text-xs font-normal text-gray-500">
            {{ t('store.product.from') }}
          </span>
          {{ formatPrice(product.price) }}
        </p>
      </div>
    </NuxtLink>
  </article>
</template>
