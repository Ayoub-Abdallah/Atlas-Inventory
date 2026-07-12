<script setup lang="ts">
definePageMeta({ layout: 'admin' });

const { t } = useI18n();
const toast = useToast();
const router = useRouter();

// ---------------------------------------------------------------------------
// Parsing & validation state
// ---------------------------------------------------------------------------
interface ParsedRow {
  line: number;
  name: string;
  sku: string;
  category: string;
  brand: string;
  price: number | undefined;
  costPrice: number | undefined;
  quantity: number | undefined;
  description: string;
  specs: Array<{ key: string; value: string }>;
  imagePaths: string[];
  technicalFilePaths: string[];
  relatedSkus: string[];
  published: boolean;
  errors: string[];
}

interface ImportResult {
  line: number;
  name: string;
  status: 'created' | 'updated' | 'skipped';
  productId?: string;
  errors: string[];
  mediaUploaded: number;
  mediaFailed: string[];
  pendingLocalFiles: string[];
}

const parsedRows = ref<ParsedRow[]>([]);
const fileName = ref('');
const parsing = ref(false);
const importing = ref(false);
const progress = ref(0);
const results = ref<ImportResult[]>([]);
const localFiles = ref<File[]>([]);

const validRows = computed(() => parsedRows.value.filter((r) => r.errors.length === 0));
const invalidRows = computed(() => parsedRows.value.filter((r) => r.errors.length > 0));

const summary = computed(() => {
  const created = results.value.filter((r) => r.status === 'created').length;
  const updated = results.value.filter((r) => r.status === 'updated').length;
  const skipped = results.value.filter((r) => r.status === 'skipped').length;
  const mediaUploaded = results.value.reduce((s, r) => s + r.mediaUploaded, 0);
  const mediaFailed = results.value.flatMap((r) =>
    r.mediaFailed.map((m) => ({ line: r.line, message: m }))
  );
  return { created, updated, skipped, mediaUploaded, mediaFailed };
});

// ---------------------------------------------------------------------------
// Template download
// ---------------------------------------------------------------------------
async function downloadTemplate() {
  const XLSX = await import('xlsx');
  const headers = [
    'name', 'sku', 'category', 'brand', 'price', 'cost_price', 'quantity',
    'description', 'specs', 'image_paths', 'technical_file_paths',
    'related_skus', 'published',
  ];
  const example = [
    'iPhone 15 Pro', 'IP15P-128', 'Smartphones', 'Apple', 219000, 195000, 5,
    'Titanium. A17 Pro.', 'Screen: 6.1"; Storage: 128GB',
    'https://example.com/iphone.jpg; photo-local.jpg',
    'https://example.com/datasheet.pdf', 'AIRPODS-2; CASE-15', 'yes',
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  XLSX.writeFile(wb, 'atlas-products-template.xlsx');
}

// ---------------------------------------------------------------------------
// Parse uploaded workbook
// ---------------------------------------------------------------------------
function splitList(value: unknown): string[] {
  return String(value ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseSpecs(value: unknown): Array<{ key: string; value: string }> {
  return splitList(value)
    .map((pair) => {
      const idx = pair.indexOf(':');
      if (idx === -1) return null;
      return { key: pair.slice(0, idx).trim(), value: pair.slice(idx + 1).trim() };
    })
    .filter((s): s is { key: string; value: string } => !!s && !!s.key);
}

function parseBool(value: unknown): boolean {
  const s = String(value ?? '').trim().toLowerCase();
  return ['yes', 'oui', 'true', '1', 'y', 'نعم'].includes(s);
}

async function handleFile(files: FileList | null) {
  const file = files?.[0];
  if (!file) return;
  parsing.value = true;
  results.value = [];
  try {
    const XLSX = await import('xlsx');
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const sheet = wb.Sheets[wb.SheetNames[0]!];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet!, {
      defval: '',
    });

    fileName.value = file.name;
    parsedRows.value = raw.map((r, i) => {
      // Case/space-insensitive header lookup
      const get = (key: string) => {
        const found = Object.keys(r).find(
          (k) => k.trim().toLowerCase().replace(/\s+/g, '_') === key
        );
        return found !== undefined ? r[found] : '';
      };

      const priceRaw = get('price');
      const price =
        priceRaw === '' || priceRaw === undefined ? undefined : Number(priceRaw);
      const costRaw = get('cost_price');
      const qtyRaw = get('quantity');

      const row: ParsedRow = {
        line: i + 2, // header is line 1
        name: String(get('name') ?? '').trim(),
        sku: String(get('sku') ?? '').trim(),
        category: String(get('category') ?? '').trim(),
        brand: String(get('brand') ?? '').trim(),
        price,
        costPrice: costRaw === '' ? undefined : Number(costRaw),
        quantity: qtyRaw === '' ? undefined : Number(qtyRaw),
        description: String(get('description') ?? '').trim(),
        specs: parseSpecs(get('specs')),
        imagePaths: splitList(get('image_paths')),
        technicalFilePaths: splitList(get('technical_file_paths')),
        relatedSkus: splitList(get('related_skus')),
        published: parseBool(get('published')),
        errors: [],
      };

      if (!row.name) row.errors.push(t('products.import.errors.name'));
      if (row.price === undefined || Number.isNaN(row.price) || row.price < 0) {
        row.errors.push(t('products.import.errors.price'));
      }
      if (!row.category) row.errors.push(t('products.import.errors.category'));
      return row;
    });

    if (parsedRows.value.length === 0) {
      toast.warning(t('products.import.emptyFile'));
    }
  } catch {
    toast.error(t('products.import.parseFailed'));
    parsedRows.value = [];
  } finally {
    parsing.value = false;
  }
}

function handleLocalFiles(files: FileList | null) {
  if (!files) return;
  localFiles.value = [...localFiles.value, ...files];
}

// How many of the referenced local paths are matched by dropped files
const localPathsReferenced = computed(() => {
  const paths = new Set<string>();
  for (const row of parsedRows.value) {
    for (const p of [...row.imagePaths, ...row.technicalFilePaths]) {
      if (!/^https?:\/\//i.test(p)) paths.add(p);
    }
  }
  return paths;
});

function basename(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

const matchedLocalCount = computed(() => {
  const names = new Set(localFiles.value.map((f) => f.name));
  let matched = 0;
  for (const p of localPathsReferenced.value) {
    if (names.has(basename(p))) matched++;
  }
  return matched;
});

// ---------------------------------------------------------------------------
// Run the import in batches
// ---------------------------------------------------------------------------
const BATCH_SIZE = 10;

async function runImport() {
  if (validRows.value.length === 0) return;
  importing.value = true;
  progress.value = 0;
  results.value = [];

  const rows = validRows.value.map((r) => ({
    line: r.line,
    name: r.name,
    sku: r.sku || undefined,
    category: r.category,
    brand: r.brand || undefined,
    price: r.price,
    costPrice: r.costPrice,
    quantity: r.quantity,
    description: r.description || undefined,
    specs: r.specs.length ? r.specs : undefined,
    imagePaths: r.imagePaths.length ? r.imagePaths : undefined,
    technicalFilePaths: r.technicalFilePaths.length ? r.technicalFilePaths : undefined,
    relatedSkus: r.relatedSkus.length ? r.relatedSkus : undefined,
    published: r.published,
  }));

  try {
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const res = await $fetch<{ results: ImportResult[] }>(
        '/api/products/import',
        { method: 'POST', body: { rows: batch } }
      );
      results.value.push(...res.results);
      progress.value = Math.min(100, Math.round(((i + batch.length) / rows.length) * 90));
    }

    // Upload dropped local files matched by filename
    const fileByName = new Map(localFiles.value.map((f) => [f.name, f]));
    for (const result of results.value) {
      if (!result.productId || result.pendingLocalFiles.length === 0) continue;
      const matched = result.pendingLocalFiles
        .map((p) => fileByName.get(basename(p)))
        .filter((f): f is File => !!f);
      if (matched.length === 0) {
        result.mediaFailed.push(
          ...result.pendingLocalFiles.map((p) => `${p}: ${t('products.import.fileNotProvided')}`)
        );
        continue;
      }
      const form = new FormData();
      for (const f of matched) form.append('files', f);
      try {
        await $fetch(`/api/products/${result.productId}/media`, {
          method: 'POST',
          body: form,
        });
        result.mediaUploaded += matched.length;
      } catch (e: any) {
        result.mediaFailed.push(e?.data?.message || 'upload_failed');
      }
    }

    progress.value = 100;
    toast.success(
      t('products.import.done', {
        created: summary.value.created,
        updated: summary.value.updated,
      })
    );
  } catch (e: any) {
    toast.error(e?.data?.message || t('products.import.failed'));
  } finally {
    importing.value = false;
  }
}

function reset() {
  parsedRows.value = [];
  results.value = [];
  localFiles.value = [];
  fileName.value = '';
  progress.value = 0;
}

useHead({ title: t('products.import.title') });
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <UiButton variant="ghost" size="icon" @click="router.push('/admin/products')">
        <Icon name="lucide:arrow-left" class="h-5 w-5 rtl:rotate-180" />
      </UiButton>
      <div class="flex-1">
        <h1 class="text-2xl font-semibold tracking-tight text-gray-900">
          {{ t('products.import.title') }}
        </h1>
        <p class="mt-1 text-sm text-gray-500">{{ t('products.import.subtitle') }}</p>
      </div>
      <UiButton variant="outline" @click="downloadTemplate">
        <Icon name="lucide:download" class="h-4 w-4 ltr:mr-2 rtl:ml-2" />
        {{ t('products.import.template') }}
      </UiButton>
    </div>

    <!-- Step 1: files -->
    <div class="grid gap-4 md:grid-cols-2">
      <label
        class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-white p-8 text-center transition-colors hover:border-primary-400 hover:bg-primary-50/30"
      >
        <Icon name="lucide:file-spreadsheet" class="h-8 w-8 text-gray-300" />
        <span class="text-sm font-medium text-gray-900">
          {{ fileName || t('products.import.dropXlsx') }}
        </span>
        <span class="text-xs text-gray-500">{{ t('products.import.xlsxHint') }}</span>
        <input
          type="file"
          accept=".xlsx,.xls"
          class="hidden"
          @change="(e: Event) => handleFile((e.target as HTMLInputElement).files)"
        >
      </label>

      <label
        class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-white p-8 text-center transition-colors hover:border-primary-400 hover:bg-primary-50/30"
      >
        <Icon name="lucide:images" class="h-8 w-8 text-gray-300" />
        <span class="text-sm font-medium text-gray-900">
          {{
            localFiles.length
              ? t('products.import.filesSelected', { count: localFiles.length })
              : t('products.import.dropMedia')
          }}
        </span>
        <span class="text-xs text-gray-500">
          {{ t('products.import.mediaHint') }}
          <template v-if="localPathsReferenced.size">
            · {{ t('products.import.matched', { matched: matchedLocalCount, total: localPathsReferenced.size }) }}
          </template>
        </span>
        <input
          type="file"
          accept="image/*,application/pdf"
          multiple
          class="hidden"
          @change="(e: Event) => handleLocalFiles((e.target as HTMLInputElement).files)"
        >
      </label>
    </div>

    <!-- Step 2: preview -->
    <div v-if="parsing" class="flex justify-center py-8">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-gray-400" />
    </div>

    <div v-else-if="parsedRows.length && !results.length" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3 text-sm">
          <span class="font-medium text-gray-900">
            {{ t('products.import.previewCount', { count: parsedRows.length }) }}
          </span>
          <span class="rounded-full bg-success-muted px-2 py-0.5 text-xs font-semibold text-success">
            {{ validRows.length }} {{ t('products.import.valid') }}
          </span>
          <span
            v-if="invalidRows.length"
            class="rounded-full bg-destructive-muted px-2 py-0.5 text-xs font-semibold text-destructive"
          >
            {{ invalidRows.length }} {{ t('products.import.invalid') }}
          </span>
        </div>
        <div class="flex gap-2">
          <UiButton variant="outline" @click="reset">{{ t('app.cancel') }}</UiButton>
          <UiButton :disabled="validRows.length === 0" :loading="importing" @click="runImport">
            <Icon name="lucide:upload" class="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {{ t('products.import.run', { count: validRows.length }) }}
          </UiButton>
        </div>
      </div>

      <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div class="max-h-[28rem] overflow-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-gray-50">
              <tr class="border-b border-gray-100 text-xs uppercase text-gray-500">
                <th class="px-3 py-2 font-medium ltr:text-left rtl:text-right">#</th>
                <th class="px-3 py-2 font-medium ltr:text-left rtl:text-right">{{ t('products.product_name') }}</th>
                <th class="px-3 py-2 font-medium ltr:text-left rtl:text-right">{{ t('products.sku') }}</th>
                <th class="px-3 py-2 font-medium ltr:text-left rtl:text-right">{{ t('products.category') }}</th>
                <th class="px-3 py-2 font-medium ltr:text-right rtl:text-left">{{ t('products.selling_price') }}</th>
                <th class="px-3 py-2 font-medium ltr:text-right rtl:text-left">{{ t('products.stock') }}</th>
                <th class="px-3 py-2 font-medium ltr:text-left rtl:text-right">{{ t('products.import.media') }}</th>
                <th class="px-3 py-2 font-medium ltr:text-left rtl:text-right">{{ t('products.import.status') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in parsedRows"
                :key="row.line"
                class="border-b border-gray-50 last:border-0"
                :class="row.errors.length ? 'bg-destructive-muted/40' : ''"
              >
                <td class="px-3 py-2 font-mono text-xs text-gray-400">{{ row.line }}</td>
                <td class="max-w-48 truncate px-3 py-2 font-medium text-gray-900">{{ row.name || '—' }}</td>
                <td class="px-3 py-2 font-mono text-xs text-gray-500">{{ row.sku || '—' }}</td>
                <td class="px-3 py-2 text-gray-600">{{ row.category || '—' }}</td>
                <td class="px-3 py-2 font-mono ltr:text-right rtl:text-left">
                  {{ row.price ?? '—' }}
                </td>
                <td class="px-3 py-2 font-mono ltr:text-right rtl:text-left">{{ row.quantity ?? '—' }}</td>
                <td class="px-3 py-2 text-xs text-gray-500">
                  {{ row.imagePaths.length + row.technicalFilePaths.length || '—' }}
                </td>
                <td class="px-3 py-2">
                  <span v-if="row.errors.length" class="text-xs font-medium text-destructive">
                    {{ row.errors.join(', ') }}
                  </span>
                  <span v-else class="text-xs font-medium text-success">
                    {{ t('products.import.ready') }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="importing" class="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          class="h-full rounded-full bg-primary-600 transition-all duration-300"
          :style="{ width: `${progress}%` }"
        />
      </div>
    </div>

    <!-- Step 3: results report -->
    <div v-else-if="results.length" class="space-y-4">
      <div class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p class="text-2xl font-bold text-success">{{ summary.created }}</p>
          <p class="text-sm text-gray-500">{{ t('products.import.created') }}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p class="text-2xl font-bold text-cobalt-600">{{ summary.updated }}</p>
          <p class="text-sm text-gray-500">{{ t('products.import.updated') }}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p class="text-2xl font-bold" :class="summary.skipped ? 'text-destructive' : 'text-gray-300'">
            {{ summary.skipped }}
          </p>
          <p class="text-sm text-gray-500">{{ t('products.import.skipped') }}</p>
        </div>
      </div>

      <p class="text-sm text-gray-600">
        {{ t('products.import.mediaSummary', { count: summary.mediaUploaded }) }}
      </p>

      <div
        v-if="summary.mediaFailed.length"
        class="rounded-xl border border-warning/30 bg-warning-muted p-4"
      >
        <p class="mb-2 text-sm font-semibold text-gray-900">
          {{ t('products.import.mediaFailures') }}
        </p>
        <ul class="max-h-40 space-y-1 overflow-auto text-xs text-gray-600">
          <li v-for="(f, i) in summary.mediaFailed" :key="i" class="font-mono">
            L{{ f.line }} · {{ f.message }}
          </li>
        </ul>
      </div>

      <div class="flex gap-2">
        <UiButton variant="outline" @click="reset">
          {{ t('products.import.another') }}
        </UiButton>
        <UiButton @click="router.push('/admin/products')">
          {{ t('products.back_to_products') }}
        </UiButton>
      </div>
    </div>
  </div>
</template>
