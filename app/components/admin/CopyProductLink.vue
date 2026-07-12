<script setup lang="ts">
/**
 * Copies the public storefront URL of a product to the clipboard,
 * ready to paste into Instagram, Facebook or TikTok posts.
 */
const props = withDefaults(
  defineProps<{
    slug: string | null | undefined;
    published: boolean | null | undefined;
    size?: 'sm' | 'md';
    label?: boolean;
  }>(),
  { size: 'sm', label: false }
);

const { t } = useI18n();
const toast = useToast();
const { settings } = useSettings();

const productUrl = computed(() => {
  if (!props.slug) return null;
  const base =
    settings.value?.siteUrl?.replace(/\/$/, '') ||
    (import.meta.client ? window.location.origin : '');
  return `${base}/product/${props.slug}`;
});

const canCopy = computed(() => !!props.slug && !!props.published);
const copied = ref(false);

async function copy() {
  if (!productUrl.value) return;
  try {
    await navigator.clipboard.writeText(productUrl.value);
    copied.value = true;
    toast.success(t('products.copyLink.copied'), productUrl.value);
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    toast.error(t('products.copyLink.failed'));
  }
}
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    :class="[
      size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm',
      canCopy
        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        : 'cursor-not-allowed bg-gray-50 text-gray-300',
    ]"
    :disabled="!canCopy"
    :title="canCopy ? t('products.copyLink.title') : t('products.copyLink.unpublished')"
    @click.stop="copy"
  >
    <Icon
      :name="copied ? 'lucide:check' : 'lucide:link'"
      :class="[size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4', copied ? 'text-success' : '']"
    />
    <span v-if="label">{{ t('products.copyLink.label') }}</span>
  </button>
</template>
