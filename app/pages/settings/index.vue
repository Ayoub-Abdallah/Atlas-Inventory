<script setup lang="ts">
const { t, locale, setLocale } = useI18n();
const loading = ref(false);
const seedLoading = ref(false);
const clearLoading = ref(false);
const { settings: fetchedSettings, updateSettings } = useSettings();

const isDev = import.meta.dev;

const settings = ref<{
  businessName: string;
  currency: 'DZD' | 'EUR' | 'USD' | 'GBP';
  defaultMargin: number;
  language: 'fr' | 'en' | 'ar';
  theme: 'default' | 'dark-grey' | 'professional-blue' | 'elegant-purple' | 'soft-green';
  invoiceTemplate: string | null;
  stockAlerts: {
    lowStock: boolean;
    outOfStock: boolean;
    emailDaily: boolean;
  };
} | null>(null);

watch(
  fetchedSettings,
  (newVal) => {
    if (newVal) {
      settings.value = JSON.parse(JSON.stringify(newVal));
    }
  },
  { immediate: true }
);

// Sync language setting with i18n locale
watch(() => settings.value?.language, (newLang) => {
  if (newLang && newLang !== locale.value) {
    setLocale(newLang);
  }
});

const toast = useToast();

// Theme definitions
const themes = [
  { id: 'default', name: 'settings.themeDefault', color: '#374151' },
  { id: 'dark-grey', name: 'settings.themeDarkGrey', color: '#1f2937' },
  { id: 'professional-blue', name: 'settings.themeProfessionalBlue', color: '#1e40af' },
  { id: 'elegant-purple', name: 'settings.themeElegantPurple', color: '#6b21a8' },
  { id: 'soft-green', name: 'settings.themeSoftGreen', color: '#166534' },
];

// Apply theme to document
function applyTheme(themeId: string) {
  if (import.meta.client) {
    document.documentElement.setAttribute('data-theme', themeId);
  }
}

// Watch for theme changes
watch(() => settings.value?.theme, (newTheme) => {
  if (newTheme) {
    applyTheme(newTheme);
  }
}, { immediate: true });

async function seedDatabase() {
  if (!isDev) return;

  seedLoading.value = true;
  try {
    const result = await $fetch('/api/__seed', { method: 'POST' });
    toast.success(
      t('settings.databaseSeeded'),
      t('settings.seedSuccess', { products: result.counts.products, categories: result.counts.categories, suppliers: result.counts.suppliers })
    );
  } catch (error: any) {
    toast.error(t('settings.seedFailed'), error.message || t('errors.generic'));
  } finally {
    seedLoading.value = false;
  }
}

async function clearDatabase() {
  if (!isDev) return;

  clearLoading.value = true;
  try {
    await $fetch('/api/__clear', { method: 'POST' });
    toast.success(
      t('settings.databaseCleared'),
      t('settings.clearSuccess')
    );
  } catch (error: any) {
    toast.error(t('settings.clearFailed'), error.message || t('errors.generic'));
  } finally {
    clearLoading.value = false;
  }
}

async function saveSettings() {
  if (!settings.value) return;

  loading.value = true;
  const success = await updateSettings(settings.value);
  loading.value = false;

  if (success) {
    toast.success(t('settings.configSaved'), t('settings.configSavedDesc'));
  } else {
    toast.error(t('errors.generic'), t('settings.saveFailed'));
  }
}

const ui = {
  card: 'bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden',
  cardHeader:
    'px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between',
  cardTitle: 'text-xs font-bold text-gray-700 uppercase tracking-wider',
  cardBody: 'p-5',
  label:
    'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5',
  input:
    'block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 sm:text-sm h-9 placeholder:text-gray-300 transition-shadow',
  inputSelect:
    'block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 sm:text-sm h-9 bg-white',
  switchBase:
    'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2',
  switchActive: 'bg-gray-900',
  switchInactive: 'bg-gray-200',
  switchKnob:
    'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
  switchKnobActive: 'translate-x-4',
  switchKnobInactive: 'translate-x-0',
};
</script>

<template>
  <div class="space-y-6 max-w-5xl mx-auto">
    <div class="flex items-end justify-between border-b border-gray-200 pb-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-gray-900">
          {{ t('settings.title') }}
        </h1>
        <p class="mt-1 text-sm text-gray-500">
          {{ t('settings.subtitle') }}
        </p>
      </div>
      <button
        @click="saveSettings"
        :disabled="loading"
        class="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <Icon
          v-if="loading"
          name="lucide:loader-2"
          class="h-4 w-4 animate-spin"
        />
        <Icon v-else name="lucide:save" class="h-4 w-4" />
        {{ t('settings.saveChanges') }}
      </button>
    </div>

    <div class="grid gap-6 lg:grid-cols-12">
      <div v-if="settings" class="lg:col-span-8 space-y-6">
        <!-- General Configuration -->
        <div :class="ui.card">
          <div :class="ui.cardHeader">
            <h2 :class="ui.cardTitle">{{ t('settings.generalConfig') }}</h2>
            <Icon name="lucide:settings-2" class="h-4 w-4 text-gray-400" />
          </div>
          <div :class="ui.cardBody">
            <div class="grid gap-5 sm:grid-cols-2">
              <div class="sm:col-span-2">
                <label :class="ui.label">{{ t('settings.workspaceName') }}</label>
                <input
                  v-model="settings.businessName"
                  type="text"
                  :class="ui.input"
                  :placeholder="t('settings.workspaceNamePlaceholder')"
                />
              </div>

              <div>
                <label :class="ui.label">{{ t('settings.currency') }}</label>
                <select v-model="settings.currency" :class="ui.inputSelect">
                  <option value="DZD">{{ t('settings.currencyDZD') }}</option>
                  <option value="EUR">{{ t('settings.currencyEUR') }}</option>
                  <option value="USD">{{ t('settings.currencyUSD') }}</option>
                  <option value="GBP">{{ t('settings.currencyGBP') }}</option>
                </select>
              </div>

              <div>
                <label :class="ui.label">{{ t('settings.defaultMargin') }}</label>
                <div class="relative rounded-md shadow-sm">
                  <input
                    v-model="settings.defaultMargin"
                    type="number"
                    :class="[ui.input, 'pr-8 font-mono']"
                  />
                  <div
                    class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3"
                  >
                    <span class="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Language & Appearance -->
        <div :class="ui.card">
          <div :class="ui.cardHeader">
            <h2 :class="ui.cardTitle">{{ t('settings.languageAppearance') }}</h2>
            <Icon name="lucide:palette" class="h-4 w-4 text-gray-400" />
          </div>
          <div :class="ui.cardBody">
            <div class="grid gap-5 sm:grid-cols-2">
              <div>
                <label :class="ui.label">{{ t('settings.language') }}</label>
                <select v-model="settings.language" :class="ui.inputSelect">
                  <option value="fr">{{ t('settings.languageFR') }}</option>
                  <option value="en">{{ t('settings.languageEN') }}</option>
                  <option value="ar">{{ t('settings.languageAR') }}</option>
                </select>
              </div>

              <div class="sm:col-span-2">
                <label :class="ui.label">{{ t('settings.theme') }}</label>
                <div class="grid grid-cols-5 gap-3 mt-2">
                  <button
                    v-for="theme in themes"
                    :key="theme.id"
                    @click="settings.theme = theme.id as any"
                    :class="[
                      'relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all',
                      settings.theme === theme.id
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    ]"
                  >
                    <div
                      class="w-8 h-8 rounded-full mb-2 shadow-sm"
                      :style="{ backgroundColor: theme.color }"
                    />
                    <span class="text-xs font-medium text-gray-700 text-center">
                      {{ t(theme.name) }}
                    </span>
                    <Icon
                      v-if="settings.theme === theme.id"
                      name="lucide:check"
                      class="absolute top-1 right-1 h-4 w-4 text-gray-900"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Links -->
        <div class="grid gap-4 sm:grid-cols-3">
          <NuxtLink
            to="/taxes"
            class="group relative flex flex-col justify-between overflow-hidden rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-md transition-all"
          >
            <div class="flex items-center justify-between mb-3">
              <div
                class="flex h-8 w-8 items-center justify-center rounded-md bg-gray-50 border border-gray-100 group-hover:bg-white group-hover:border-gray-200 transition-colors"
              >
                <Icon
                  name="lucide:percent"
                  class="h-4 w-4 text-gray-500 group-hover:text-gray-900"
                />
              </div>
              <Icon
                name="lucide:arrow-right"
                class="h-4 w-4 text-gray-300 group-hover:text-gray-600 -rotate-45 group-hover:rotate-0 transition-transform duration-300"
              />
            </div>
            <div>
              <h3 class="font-semibold text-gray-900">{{ t('nav.taxes') }}</h3>
              <p class="text-xs text-gray-500 mt-1">
                {{ t('settings.manageTaxes') }}
              </p>
            </div>
          </NuxtLink>

          <NuxtLink
            to="/categories"
            class="group relative flex flex-col justify-between overflow-hidden rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-md transition-all"
          >
            <div class="flex items-center justify-between mb-3">
              <div
                class="flex h-8 w-8 items-center justify-center rounded-md bg-gray-50 border border-gray-100 group-hover:bg-white group-hover:border-gray-200 transition-colors"
              >
                <Icon
                  name="lucide:folder-tree"
                  class="h-4 w-4 text-gray-500 group-hover:text-gray-900"
                />
              </div>
              <Icon
                name="lucide:arrow-right"
                class="h-4 w-4 text-gray-300 group-hover:text-gray-600 -rotate-45 group-hover:rotate-0 transition-transform duration-300"
              />
            </div>
            <div>
              <h3 class="font-semibold text-gray-900">{{ t('nav.categories') }}</h3>
              <p class="text-xs text-gray-500 mt-1">{{ t('settings.organizeInventory') }}</p>
            </div>
          </NuxtLink>

          <NuxtLink
            to="/suppliers"
            class="group relative flex flex-col justify-between overflow-hidden rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-md transition-all"
          >
            <div class="flex items-center justify-between mb-3">
              <div
                class="flex h-8 w-8 items-center justify-center rounded-md bg-gray-50 border border-gray-100 group-hover:bg-white group-hover:border-gray-200 transition-colors"
              >
                <Icon
                  name="lucide:truck"
                  class="h-4 w-4 text-gray-500 group-hover:text-gray-900"
                />
              </div>
              <Icon
                name="lucide:arrow-right"
                class="h-4 w-4 text-gray-300 group-hover:text-gray-600 -rotate-45 group-hover:rotate-0 transition-transform duration-300"
              />
            </div>
            <div>
              <h3 class="font-semibold text-gray-900">{{ t('nav.suppliers') }}</h3>
              <p class="text-xs text-gray-500 mt-1">{{ t('settings.manageVendors') }}</p>
            </div>
          </NuxtLink>
        </div>
      </div>

      <div class="lg:col-span-4 space-y-6">
        <div v-if="settings" :class="ui.card">
          <div :class="ui.cardHeader">
            <h2 :class="ui.cardTitle">{{ t('settings.notifications') }}</h2>
            <Icon name="lucide:bell" class="h-4 w-4 text-gray-400" />
          </div>

          <div class="divide-y divide-gray-100">
            <div class="flex items-center justify-between p-4">
              <div class="flex-1 pr-4">
                <p class="text-sm font-medium text-gray-900">{{ t('settings.lowStockAlert') }}</p>
                <p class="text-xs text-gray-500 mt-0.5">
                  {{ t('settings.lowStockAlertDesc') }}
                </p>
              </div>
              <button
                type="button"
                class="group"
                @click="
                  settings.stockAlerts.lowStock = !settings.stockAlerts.lowStock
                "
              >
                <span
                  :class="[
                    settings.stockAlerts.lowStock
                      ? ui.switchActive
                      : ui.switchInactive,
                    ui.switchBase,
                  ]"
                >
                  <span
                    :class="[
                      settings.stockAlerts.lowStock
                        ? ui.switchKnobActive
                        : ui.switchKnobInactive,
                      ui.switchKnob,
                    ]"
                  />
                </span>
              </button>
            </div>

            <div class="flex items-center justify-between p-4">
              <div class="flex-1 pr-4">
                <p class="text-sm font-medium text-gray-900">{{ t('settings.outOfStock') }}</p>
                <p class="text-xs text-gray-500 mt-0.5">
                  {{ t('settings.outOfStockDesc') }}
                </p>
              </div>
              <button
                type="button"
                class="group"
                @click="
                  settings.stockAlerts.outOfStock =
                    !settings.stockAlerts.outOfStock
                "
              >
                <span
                  :class="[
                    settings.stockAlerts.outOfStock
                      ? ui.switchActive
                      : ui.switchInactive,
                    ui.switchBase,
                  ]"
                >
                  <span
                    :class="[
                      settings.stockAlerts.outOfStock
                        ? ui.switchKnobActive
                        : ui.switchKnobInactive,
                      ui.switchKnob,
                    ]"
                  />
                </span>
              </button>
            </div>
          </div>

          <div class="bg-gray-50 px-4 py-3 border-t border-gray-100">
            <p class="text-xs text-gray-500 text-center">
              {{ t('settings.alertsSentTo') }}
              <span class="font-medium text-gray-900">admin@atlas-inventory.app</span>
            </p>
          </div>
        </div>

        <div
          v-if="isDev"
          :class="ui.card"
          class="border-amber-200 bg-amber-50/30"
        >
          <div :class="ui.cardHeader" class="bg-amber-50 border-amber-100">
            <h2 :class="ui.cardTitle" class="text-amber-700">
              {{ t('settings.developerTools') }}
            </h2>
            <Icon name="lucide:code-2" class="h-4 w-4 text-amber-500" />
          </div>
          <div class="p-4 space-y-4">
            <div class="flex items-start gap-3">
              <div class="flex-shrink-0 mt-0.5">
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 border border-amber-200"
                >
                  <Icon name="lucide:database" class="h-4 w-4 text-amber-600" />
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900">{{ t('settings.seedDatabase') }}</p>
                <p class="text-xs text-gray-500 mt-0.5">
                  {{ t('settings.seedDatabaseDesc') }}
                </p>
              </div>
            </div>
            <button
              @click="seedDatabase"
              :disabled="seedLoading || clearLoading"
              class="w-full inline-flex items-center justify-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Icon
                v-if="seedLoading"
                name="lucide:loader-2"
                class="h-4 w-4 animate-spin"
              />
              <Icon v-else name="lucide:sparkles" class="h-4 w-4" />
              {{ seedLoading ? t('settings.seeding') : t('settings.seedSampleData') }}
            </button>

            <div class="border-t border-amber-200 pt-4 mt-4">
              <div class="flex items-start gap-3 mb-3">
                <div class="flex-shrink-0 mt-0.5">
                  <div
                    class="flex h-8 w-8 items-center justify-center rounded-md bg-red-100 border border-red-200"
                  >
                    <Icon name="lucide:trash-2" class="h-4 w-4 text-red-600" />
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900">
                    {{ t('settings.clearDatabase') }}
                  </p>
                  <p class="text-xs text-gray-500 mt-0.5">
                    {{ t('settings.clearDatabaseDesc') }}
                  </p>
                </div>
              </div>
              <button
                @click="clearDatabase"
                :disabled="clearLoading || seedLoading"
                class="w-full inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Icon
                  v-if="clearLoading"
                  name="lucide:loader-2"
                  class="h-4 w-4 animate-spin"
                />
                <Icon v-else name="lucide:trash-2" class="h-4 w-4" />
                {{ clearLoading ? t('settings.clearing') : t('settings.clearAllData') }}
              </button>
            </div>

            <p class="text-xs text-amber-600 text-center">
              <Icon
                name="lucide:alert-triangle"
                class="h-3 w-3 inline-block mr-1"
              />
              {{ t('settings.actionsCannotBeUndone') }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>