<script setup lang="ts">
import { whatsappLink, formatPhone } from '~~/shared/utils/phone';

const { t } = useI18n();
const { config } = useShopConfig();

const waHref = computed(() =>
  whatsappLink(config.value?.storePhone, config.value?.phoneCountryCode || '+213')
);
const year = new Date().getFullYear();
</script>

<template>
  <footer class="border-t border-gray-100 bg-gray-50 font-store">
    <div class="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
      <div>
        <img src="/branding/logo-small.webp" alt="" class="mb-3 h-8 w-auto" >
        <p class="max-w-xs text-sm leading-relaxed text-gray-600">
          {{ t('store.footer.tagline') }}
        </p>
      </div>

      <nav :aria-label="t('store.footer.links')">
        <h2 class="mb-3 font-display text-sm font-semibold text-ink">
          {{ t('store.footer.links') }}
        </h2>
        <ul class="space-y-2 text-sm text-gray-600">
          <li>
            <NuxtLink to="/shop" class="hover:text-cobalt-600">{{ t('store.nav.shop') }}</NuxtLink>
          </li>
          <li>
            <NuxtLink to="/cart" class="hover:text-cobalt-600">{{ t('store.nav.cart') }}</NuxtLink>
          </li>
          <li>
            <NuxtLink to="/#repairs" class="hover:text-cobalt-600">{{ t('store.footer.repairs') }}</NuxtLink>
          </li>
        </ul>
      </nav>

      <div>
        <h2 class="mb-3 font-display text-sm font-semibold text-ink">
          {{ t('store.footer.contact') }}
        </h2>
        <ul class="space-y-2 text-sm text-gray-600">
          <li v-if="config?.storePhone" class="flex items-center gap-2">
            <Icon name="lucide:phone" class="h-4 w-4 shrink-0 text-gray-400" />
            <a :href="`tel:${config.storePhone}`" class="hover:text-cobalt-600" dir="ltr">
              {{ formatPhone(config.storePhone) || config.storePhone }}
            </a>
          </li>
          <li v-if="waHref" class="flex items-center gap-2">
            <Icon name="lucide:message-circle" class="h-4 w-4 shrink-0 text-gray-400" />
            <a :href="waHref" target="_blank" rel="noopener" class="hover:text-cobalt-600">
              WhatsApp
            </a>
          </li>
          <li v-if="config?.storeAddress" class="flex items-start gap-2">
            <Icon name="lucide:map-pin" class="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <span>{{ config.storeAddress }}</span>
          </li>
        </ul>
      </div>
    </div>

    <div class="border-t border-gray-100 py-4">
      <p class="mx-auto max-w-7xl px-4 text-xs text-gray-500 sm:px-6">
        © {{ year }} {{ config?.businessName || 'Atlas' }}. {{ t('store.footer.rights') }}
      </p>
    </div>
  </footer>
</template>
