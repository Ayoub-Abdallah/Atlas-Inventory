<script setup lang="ts">
import { whatsappLink, formatPhone } from '~~/shared/utils/phone';

/** Repair section contact actions: WhatsApp deep link + phone call. */
const { t } = useI18n();
const { config } = useShopConfig();

const waHref = computed(() =>
  whatsappLink(
    config.value?.storePhone,
    config.value?.phoneCountryCode || '+213',
    t('store.home.repairs.cta')
  )
);
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <a
      v-if="waHref"
      :href="waHref"
      target="_blank"
      rel="noopener"
      class="flex h-11 items-center gap-2 rounded-full bg-[#25D366] px-6 text-sm font-semibold text-white transition-all hover:brightness-95 active:scale-[0.98]"
    >
      <Icon name="lucide:message-circle" class="h-4.5 w-4.5" />
      {{ t('store.home.repairs.cta') }}
    </a>
    <a
      v-if="config?.storePhone"
      :href="`tel:${config.storePhone}`"
      class="flex h-11 items-center gap-2 rounded-full border-2 border-gray-200 px-6 text-sm font-semibold text-ink transition-colors hover:border-cobalt-300 hover:text-cobalt-700"
      dir="ltr"
    >
      <Icon name="lucide:phone" class="h-4 w-4" />
      {{ formatPhone(config.storePhone) || config.storePhone }}
    </a>
    <NuxtLink
      v-else-if="!waHref"
      to="/shop"
      class="flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-cobalt-600"
    >
      {{ t('store.home.heroCtaShop') }}
    </NuxtLink>
  </div>
</template>
