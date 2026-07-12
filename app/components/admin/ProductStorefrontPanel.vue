<script setup lang="ts">
import type { MediaAsset, Product } from '~~/server/database/schema';

/**
 * Storefront panel on the product page: publish state, gallery images,
 * technical PDFs, specs, and the related-products picker.
 */
const props = defineProps<{
  product: Product & { media?: MediaAsset[] };
}>();
const emit = defineEmits<{ updated: [] }>();

const { t } = useI18n();
const toast = useToast();
const { canEdit } = useAuth();

const productId = computed(() => props.product.id);

// ---------------------------------------------------------------------------
// Publish state
// ---------------------------------------------------------------------------
const published = ref(!!props.product.published);
const publishing = ref(false);

async function togglePublish() {
  publishing.value = true;
  try {
    const res = await $fetch(`/api/products/${productId.value}/publish`, {
      method: 'PUT',
      body: { published: !published.value },
    });
    published.value = res.published;
    toast.success(
      res.published ? t('products.publish.published') : t('products.publish.unpublished')
    );
    emit('updated');
  } catch (e: any) {
    toast.error(e?.data?.message || t('products.publish.failed'));
  } finally {
    publishing.value = false;
  }
}

// ---------------------------------------------------------------------------
// Media manager
// ---------------------------------------------------------------------------
const media = ref<MediaAsset[]>([...(props.product.media || [])]);
const images = computed(() => media.value.filter((m) => m.kind === 'image'));
const documents = computed(() => media.value.filter((m) => m.kind === 'document'));

const uploading = ref(false);
const dragOver = ref(false);
const imageInput = ref<HTMLInputElement>();
const pdfInput = ref<HTMLInputElement>();

async function refreshMedia() {
  media.value = await $fetch(`/api/products/${productId.value}/media`);
}

async function uploadFiles(files: FileList | File[]) {
  const list = [...files];
  if (list.length === 0) return;
  uploading.value = true;
  try {
    const form = new FormData();
    for (const file of list) form.append('files', file);
    await $fetch(`/api/products/${productId.value}/media`, {
      method: 'POST',
      body: form,
    });
    await refreshMedia();
    toast.success(t('products.media.uploaded', { count: list.length }));
    emit('updated');
  } catch (e: any) {
    toast.error(e?.data?.message || t('products.media.uploadFailed'));
  } finally {
    uploading.value = false;
  }
}

function onDrop(e: DragEvent) {
  dragOver.value = false;
  if (e.dataTransfer?.files?.length) uploadFiles(e.dataTransfer.files);
}

async function removeMedia(asset: MediaAsset) {
  try {
    await $fetch(`/api/products/${productId.value}/media/${asset.id}`, {
      method: 'DELETE',
    });
    media.value = media.value.filter((m) => m.id !== asset.id);
    toast.success(t('products.media.deleted'));
    emit('updated');
  } catch (e: any) {
    toast.error(e?.data?.message || t('products.media.deleteFailed'));
  }
}

async function moveImage(asset: MediaAsset, direction: -1 | 1) {
  const list = [...images.value];
  const index = list.findIndex((m) => m.id === asset.id);
  const target = index + direction;
  if (target < 0 || target >= list.length) return;
  [list[index], list[target]] = [list[target]!, list[index]!];
  // Optimistic reorder, then persist
  media.value = [...list, ...documents.value];
  await $fetch(`/api/products/${productId.value}/media/reorder`, {
    method: 'PUT',
    body: { orderedIds: list.map((m) => m.id) },
  });
  emit('updated');
}

// ---------------------------------------------------------------------------
// Brand + specs + related products (saved together)
// ---------------------------------------------------------------------------
const brand = ref(props.product.brand || '');
const specs = ref<Array<{ key: string; value: string }>>(
  Array.isArray(props.product.specs)
    ? [...(props.product.specs as Array<{ key: string; value: string }>)]
    : []
);

function addSpec() {
  specs.value.push({ key: '', value: '' });
}
function removeSpec(index: number) {
  specs.value.splice(index, 1);
}

// Related products picker
interface PickedProduct {
  id: string;
  name: string;
  sku?: string | null;
}
const relatedPicks = ref<PickedProduct[]>([]);
const relatedSearch = ref('');
const relatedResults = ref<PickedProduct[]>([]);
const searching = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

// Resolve names of already-linked related products
onMounted(async () => {
  const ids = Array.isArray(props.product.relatedProducts)
    ? (props.product.relatedProducts as string[])
    : [];
  if (ids.length === 0) return;
  try {
    const all = await $fetch<Array<{ id: string; name: string; sku: string | null }>>(
      '/api/products'
    );
    relatedPicks.value = ids
      .map((id) => all.find((p) => p.id === id))
      .filter((p): p is PickedProduct => !!p);
  } catch {
    // Panel still works; picker just starts empty
  }
});

watch(relatedSearch, (q) => {
  if (searchTimer) clearTimeout(searchTimer);
  if (!q.trim()) {
    relatedResults.value = [];
    return;
  }
  searchTimer = setTimeout(async () => {
    searching.value = true;
    try {
      const results = await $fetch<PickedProduct[]>('/api/products/search', {
        query: { q: q.trim(), limit: 8 },
      });
      relatedResults.value = results.filter(
        (r) =>
          r.id !== productId.value &&
          !relatedPicks.value.some((p) => p.id === r.id)
      );
    } finally {
      searching.value = false;
    }
  }, 250);
});

function pickRelated(p: PickedProduct) {
  if (relatedPicks.value.length >= 12) return;
  relatedPicks.value.push(p);
  relatedResults.value = relatedResults.value.filter((r) => r.id !== p.id);
  relatedSearch.value = '';
}

function unpickRelated(id: string) {
  relatedPicks.value = relatedPicks.value.filter((p) => p.id !== id);
}

const saving = ref(false);
async function saveStorefront() {
  saving.value = true;
  try {
    await $fetch(`/api/products/${productId.value}/storefront`, {
      method: 'PUT',
      body: {
        brand: brand.value,
        specs: specs.value.filter((s) => s.key.trim()),
        relatedProducts: relatedPicks.value.map((p) => p.id),
      },
    });
    toast.success(t('products.storefront.saved'));
    emit('updated');
  } catch (e: any) {
    toast.error(e?.data?.message || t('products.storefront.saveFailed'));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
    <!-- Panel header: publish state + link -->
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-medium text-gray-900">
          {{ t('products.storefront.title') }}
        </h2>
        <span
          class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
          :class="published ? 'bg-success-muted text-success' : 'bg-gray-100 text-gray-500'"
        >
          <span class="h-1.5 w-1.5 rounded-full" :class="published ? 'bg-success' : 'bg-gray-400'" />
          {{ published ? t('products.publish.statusOn') : t('products.publish.statusOff') }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <AdminCopyProductLink :slug="product.slug" :published="published" size="md" label />
        <UiButton
          v-if="canEdit"
          :variant="published ? 'outline' : 'primary'"
          size="sm"
          :loading="publishing"
          @click="togglePublish"
        >
          <Icon
            :name="published ? 'lucide:globe-lock' : 'lucide:globe'"
            class="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5"
          />
          {{ published ? t('products.publish.toggleOff') : t('products.publish.toggleOn') }}
        </UiButton>
      </div>
    </div>

    <div class="space-y-6 p-6">
      <!-- Gallery -->
      <section>
        <h3 class="mb-3 text-sm font-semibold text-gray-900">
          {{ t('products.media.gallery') }}
          <span class="font-normal text-gray-400">({{ images.length }})</span>
        </h3>
        <div
          class="rounded-xl border-2 border-dashed p-4 transition-colors"
          :class="dragOver ? 'border-cobalt-400 bg-cobalt-50/50' : 'border-gray-200'"
          @dragover.prevent="dragOver = true"
          @dragleave.prevent="dragOver = false"
          @drop.prevent="onDrop"
        >
          <div v-if="images.length" class="mb-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            <div
              v-for="(img, i) in images"
              :key="img.id"
              class="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
            >
              <img :src="img.url" :alt="img.alt || product.name" class="h-full w-full object-cover" loading="lazy" >
              <span
                v-if="i === 0"
                class="absolute top-1 rounded-full bg-cobalt-600 px-1.5 py-0.5 text-[10px] font-bold text-white ltr:left-1 rtl:right-1"
              >
                {{ t('products.media.cover') }}
              </span>
              <div
                v-if="canEdit"
                class="absolute inset-0 flex items-center justify-center gap-1 bg-ink/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              >
                <button
                  type="button"
                  class="rounded-md bg-white/90 p-1.5 text-gray-700 hover:bg-white disabled:opacity-40"
                  :disabled="i === 0"
                  :title="t('products.media.moveLeft')"
                  @click="moveImage(img, -1)"
                >
                  <Icon name="lucide:arrow-left" class="h-3.5 w-3.5 rtl:rotate-180" />
                </button>
                <button
                  type="button"
                  class="rounded-md bg-white/90 p-1.5 text-gray-700 hover:bg-white disabled:opacity-40"
                  :disabled="i === images.length - 1"
                  :title="t('products.media.moveRight')"
                  @click="moveImage(img, 1)"
                >
                  <Icon name="lucide:arrow-right" class="h-3.5 w-3.5 rtl:rotate-180" />
                </button>
                <button
                  type="button"
                  class="rounded-md bg-white/90 p-1.5 text-red-600 hover:bg-white"
                  :title="t('app.delete')"
                  @click="removeMedia(img)"
                >
                  <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div class="flex flex-col items-center justify-center gap-2 py-4 text-center">
            <Icon name="lucide:image-plus" class="h-6 w-6 text-gray-300" />
            <p class="text-xs text-gray-500">{{ t('products.media.dropHint') }}</p>
            <UiButton
              v-if="canEdit"
              variant="outline"
              size="sm"
              :loading="uploading"
              @click="imageInput?.click()"
            >
              {{ t('products.media.browse') }}
            </UiButton>
            <input
              ref="imageInput"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              multiple
              class="hidden"
              @change="(e: Event) => uploadFiles((e.target as HTMLInputElement).files || [])"
            >
          </div>
        </div>
      </section>

      <!-- Technical documents -->
      <section>
        <h3 class="mb-3 text-sm font-semibold text-gray-900">
          {{ t('products.media.documents') }}
          <span class="font-normal text-gray-400">({{ documents.length }})</span>
        </h3>
        <ul v-if="documents.length" class="mb-3 space-y-2">
          <li
            v-for="doc in documents"
            :key="doc.id"
            class="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2"
          >
            <a
              :href="doc.url"
              target="_blank"
              rel="noopener"
              class="flex min-w-0 items-center gap-2 text-sm text-gray-800 hover:text-cobalt-600"
            >
              <Icon name="lucide:file-text" class="h-4 w-4 shrink-0 text-red-500" />
              <span class="truncate">{{ doc.filename }}</span>
              <span v-if="doc.size" class="shrink-0 text-xs text-gray-400">
                {{ (doc.size / 1024 / 1024).toFixed(1) }} MB
              </span>
            </a>
            <button
              v-if="canEdit"
              type="button"
              class="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
              :title="t('app.delete')"
              @click="removeMedia(doc)"
            >
              <Icon name="lucide:trash-2" class="h-4 w-4" />
            </button>
          </li>
        </ul>
        <UiButton
          v-if="canEdit"
          variant="outline"
          size="sm"
          :loading="uploading"
          @click="pdfInput?.click()"
        >
          <Icon name="lucide:file-plus" class="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
          {{ t('products.media.addPdf') }}
        </UiButton>
        <input
          ref="pdfInput"
          type="file"
          accept="application/pdf"
          multiple
          class="hidden"
          @change="(e: Event) => uploadFiles((e.target as HTMLInputElement).files || [])"
        >
      </section>

      <!-- Brand + specs -->
      <section class="grid gap-6 md:grid-cols-2">
        <div>
          <label class="mb-1.5 block text-sm font-semibold text-gray-900" for="sf-brand">
            {{ t('products.storefront.brand') }}
          </label>
          <input
            id="sf-brand"
            v-model="brand"
            type="text"
            :disabled="!canEdit"
            class="h-9 w-full rounded-md border border-gray-200 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-gray-50"
            :placeholder="t('products.storefront.brandPlaceholder')"
          >
        </div>
      </section>

      <section>
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-900">
            {{ t('products.storefront.specs') }}
          </h3>
          <UiButton v-if="canEdit" variant="ghost" size="sm" @click="addSpec">
            <Icon name="lucide:plus" class="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
            {{ t('products.storefront.addSpec') }}
          </UiButton>
        </div>
        <p v-if="specs.length === 0" class="text-xs text-gray-400">
          {{ t('products.storefront.noSpecs') }}
        </p>
        <div v-else class="space-y-2">
          <div v-for="(spec, i) in specs" :key="i" class="flex items-center gap-2">
            <input
              v-model="spec.key"
              type="text"
              :disabled="!canEdit"
              :placeholder="t('products.storefront.specKey')"
              :aria-label="t('products.storefront.specKey')"
              class="h-9 w-1/3 rounded-md border border-gray-200 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-gray-50"
            >
            <input
              v-model="spec.value"
              type="text"
              :disabled="!canEdit"
              :placeholder="t('products.storefront.specValue')"
              :aria-label="t('products.storefront.specValue')"
              class="h-9 flex-1 rounded-md border border-gray-200 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-gray-50"
            >
            <button
              v-if="canEdit"
              type="button"
              class="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
              :title="t('app.delete')"
              @click="removeSpec(i)"
            >
              <Icon name="lucide:x" class="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <!-- Related products -->
      <section>
        <h3 class="mb-1.5 text-sm font-semibold text-gray-900">
          {{ t('products.storefront.related') }}
        </h3>
        <p class="mb-3 text-xs text-gray-500">{{ t('products.storefront.relatedHint') }}</p>

        <div v-if="relatedPicks.length" class="mb-3 flex flex-wrap gap-2">
          <span
            v-for="pick in relatedPicks"
            :key="pick.id"
            class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700"
          >
            {{ pick.name }}
            <button
              v-if="canEdit"
              type="button"
              class="text-gray-400 hover:text-red-600"
              :aria-label="`${t('app.delete')} ${pick.name}`"
              @click="unpickRelated(pick.id)"
            >
              <Icon name="lucide:x" class="h-3 w-3" />
            </button>
          </span>
        </div>

        <div v-if="canEdit" class="relative">
          <Icon
            name="lucide:search"
            class="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 ltr:left-3 rtl:right-3"
          />
          <input
            v-model="relatedSearch"
            type="search"
            :placeholder="t('products.storefront.searchProducts')"
            :aria-label="t('products.storefront.searchProducts')"
            class="h-9 w-full rounded-md border border-gray-200 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 ltr:pl-9 ltr:pr-3 rtl:pr-9 rtl:pl-3"
          >
          <ul
            v-if="relatedResults.length || searching"
            class="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-100 bg-white py-1 shadow-lg"
          >
            <li v-if="searching" class="px-3 py-2 text-xs text-gray-400">
              {{ t('app.loading') }}
            </li>
            <li v-for="result in relatedResults" :key="result.id">
              <button
                type="button"
                class="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-50"
                @click="pickRelated(result)"
              >
                <span>{{ result.name }}</span>
                <span v-if="result.sku" class="font-mono text-xs text-gray-400">{{ result.sku }}</span>
              </button>
            </li>
          </ul>
        </div>
      </section>

      <!-- Save -->
      <div v-if="canEdit" class="flex justify-end border-t border-gray-100 pt-4">
        <UiButton :loading="saving" @click="saveStorefront">
          {{ t('products.storefront.save') }}
        </UiButton>
      </div>
    </div>
  </div>
</template>
