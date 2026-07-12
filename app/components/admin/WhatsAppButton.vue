<script setup lang="ts">
import { normalizePhone, whatsappLink } from '~~/shared/utils/phone';

/**
 * WhatsApp deep-link button (wa.me). Pure client-side link building,
 * no webhooks and no API integration. Invalid numbers disable the
 * button with an explanatory tooltip.
 */
const props = withDefaults(
  defineProps<{
    phone: string | null | undefined;
    message?: string;
    size?: 'sm' | 'md';
    label?: boolean; // show text next to the icon
  }>(),
  { message: '', size: 'sm', label: false }
);

const { t } = useI18n();
const { settings } = useSettings();

const countryCode = computed(() => settings.value?.phoneCountryCode || '+213');
const normalized = computed(() => normalizePhone(props.phone, countryCode.value));
const href = computed(() =>
  whatsappLink(props.phone, countryCode.value, props.message || undefined)
);
</script>

<template>
  <a
    v-if="href"
    :href="href"
    target="_blank"
    rel="noopener"
    class="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#25D366]/10 font-medium text-[#128C4A] transition-colors hover:bg-[#25D366]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]"
    :class="size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm'"
    :title="t('orders.whatsapp.open', { phone: normalized })"
    @click.stop
  >
    <Icon name="lucide:message-circle" :class="size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'" />
    <span v-if="label">WhatsApp</span>
  </a>
  <span
    v-else
    class="inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-md bg-gray-100 font-medium text-gray-400"
    :class="size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm'"
    :title="t('orders.whatsapp.invalid')"
    :aria-disabled="true"
  >
    <Icon name="lucide:message-circle" :class="size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'" />
    <span v-if="label">WhatsApp</span>
  </span>
</template>
