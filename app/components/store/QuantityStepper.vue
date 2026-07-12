<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: number;
    min?: number;
    max?: number;
  }>(),
  { min: 1, max: 99 }
);
const emit = defineEmits<{ 'update:modelValue': [number] }>();
const { t } = useI18n();

function set(next: number) {
  emit('update:modelValue', Math.min(props.max, Math.max(props.min, next)));
}
</script>

<template>
  <div class="inline-flex h-11 items-center rounded-full border border-gray-200 bg-white font-store">
    <button
      type="button"
      class="flex h-full w-11 items-center justify-center rounded-full text-gray-600 transition-colors hover:text-ink disabled:opacity-30"
      :disabled="modelValue <= min"
      :aria-label="t('store.cart.decrease')"
      @click="set(modelValue - 1)"
    >
      <Icon name="lucide:minus" class="h-4 w-4" />
    </button>
    <input
      :value="modelValue"
      type="number"
      :min="min"
      :max="max"
      inputmode="numeric"
      class="w-10 border-0 bg-transparent p-0 text-center text-sm font-semibold text-ink focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      :aria-label="t('store.cart.quantity')"
      @change="set(Number(($event.target as HTMLInputElement).value) || min)"
    >
    <button
      type="button"
      class="flex h-full w-11 items-center justify-center rounded-full text-gray-600 transition-colors hover:text-ink disabled:opacity-30"
      :disabled="modelValue >= max"
      :aria-label="t('store.cart.increase')"
      @click="set(modelValue + 1)"
    >
      <Icon name="lucide:plus" class="h-4 w-4" />
    </button>
  </div>
</template>
