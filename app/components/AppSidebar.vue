<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { user, isAdmin, logout } = useAuth();

const navigation = computed(() => [
  { name: t('nav.dashboard'), href: '/', icon: 'lucide:layout-dashboard' },
  { name: t('nav.scan'), href: '/stock/scan', icon: 'lucide:scan-barcode' },
  { name: t('nav.products'), href: '/products', icon: 'lucide:package' },
  { name: t('nav.categories'), href: '/categories', icon: 'lucide:folder-tree' },
  { name: t('nav.suppliers'), href: '/suppliers', icon: 'lucide:truck' },
  { name: t('nav.movements'), href: '/movements', icon: 'lucide:arrow-left-right' },
  { name: t('nav.sales'), href: '/sales', icon: 'lucide:receipt' },
  { name: t('nav.finance'), href: '/finance', icon: 'lucide:chart-line' },
]);

const secondaryNavigation = computed(() => {
  const items = [
    { name: t('nav.taxes'), href: '/taxes', icon: 'lucide:percent' },
    { name: t('nav.settings'), href: '/settings', icon: 'lucide:settings' },
  ];

  // Add Users link for admins only
  if (isAdmin.value) {
    items.unshift({ name: t('nav.users'), href: '/users', icon: 'lucide:users' });
  }

  return items;
});

function isActive(href: string): boolean {
  if (href === '/') {
    return route.path === '/';
  }
  return route.path.startsWith(href);
}

async function handleLogout() {
  await logout();
  await router.push('/auth/login');
}
</script>

<template>
  <aside class="flex w-64 flex-col border-gray-200 bg-white ltr:border-r rtl:border-l">
    <!-- Header -->
    <div class="flex h-16 items-center gap-3 border-b border-gray-100 px-6">
      <div
        class="flex h-10 w-28 shrink-0 items-center justify-center"
      >
        <!-- <Icon name="lucide:boxes" class="h-5 w-5" /> -->
        <img src="/branding/logo.png" class="w-22" />

      </div>
      <!-- 
     <div class="flex flex-col">
        <span class="text-sm font-bold tracking-tight text-gray-900"
          >Atlas</span
        >
        <span
          class="text-[10px] font-medium text-gray-51000 uppercase tracking-wider"
          >Inventory</span
        > 
      </div>
      -->
    </div>

    <!-- Navigation -->
    <nav class="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
      <!-- Main navigation -->
      <div class="flex flex-col gap-1">
        <NuxtLink
          v-for="item in navigation"
          :key="item.name"
          :to="item.href"
          class="group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200"
          :class="[
            isActive(item.href)
              ? 'bg-primary-50 text-primary-700'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
          ]"
        >
          <Icon
            :name="item.icon"
            class="h-4.5 w-4.5 shrink-0 transition-colors"
            :class="
              isActive(item.href)
                ? 'text-primary-600'
                : 'text-gray-400 group-hover:text-gray-600'
            "
          />
          <span>{{ item.name }}</span>
          <div
            v-if="isActive(item.href)"
            class="ltr:ml-auto rtl:mr-auto h-1.5 w-1.5 rounded-full bg-primary-600"
          />
        </NuxtLink>
      </div>

      <!-- Separator -->
      <div class="my-4 h-px bg-gray-100" />

      <!-- Secondary navigation -->
      <div class="flex flex-col gap-1">
        <p
          class="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2"
        >
          {{ t('nav.system') }}
        </p>
        <NuxtLink
          v-for="item in secondaryNavigation"
          :key="item.name"
          :to="item.href"
          class="group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200"
          :class="[
            isActive(item.href)
              ? 'bg-primary-50 text-primary-700'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
          ]"
        >
          <Icon
            :name="item.icon"
            class="h-4.5 w-4.5 shrink-0 transition-colors"
            :class="
              isActive(item.href)
                ? 'text-primary-600'
                : 'text-gray-400 group-hover:text-gray-600'
            "
          />
          <span>{{ item.name }}</span>
        </NuxtLink>
      </div>

      <!-- Spacer -->
      <div class="flex-1" />

      <!-- User Card -->
      <div class="mt-4 rounded-xl border border-gray-100 bg-gray-50/50 p-3">
        <div class="flex items-center gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm border border-gray-100"
          >
            <Icon name="lucide:user" class="h-4 w-4 text-gray-600" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="truncate text-sm font-semibold text-gray-900">
              {{ user?.name || 'User' }}
            </p>
            <p class="truncate text-xs text-gray-500">{{ user?.email }}</p>
          </div>
          <button
            @click="handleLogout"
            class="text-gray-400 hover:text-gray-600 transition-colors"
            title="Sign out"
          >
            <Icon name="lucide:log-out" class="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  </aside>
</template>
