<script setup lang="ts">
definePageMeta({ layout: 'admin' });
const { t } = useI18n();
const { data: rows } = await useFetch('/api/returns');
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">{{ t('returns.title') }}</h1>
    </div>

    <div>
      <table class="w-full">
        <thead>
          <tr class="border-b">
            <th class="py-2">ID</th>
            <th class="py-2">Sale</th>
            <th class="py-2">Type</th>
            <th class="py-2">Amount</th>
            <th class="py-2">Status</th>
            <th class="py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id" class="border-b">
            <td class="py-2 font-mono">{{ r.id }}</td>
            <td class="py-2">{{ r.saleId }}</td>
            <td class="py-2">{{ r.type }}</td>
            <td class="py-2">{{ r.totalAmount }}</td>
            <td class="py-2">{{ r.status }}</td>
            <td class="py-2">{{ new Date(r.createdAt * 1000).toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
