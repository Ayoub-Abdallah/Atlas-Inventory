// Route access rules:
// - Public surfaces (landing, storefront) need no session
// - /admin/** requires authentication; /admin/users requires the admin role
// - /auth/* handles login and first-time setup
const ADMIN_ONLY_ROUTES = ['/admin/users'];

export default defineNuxtRouteMiddleware(async (to) => {
  const isAdminArea = to.path === '/admin' || to.path.startsWith('/admin/');
  const isAuthArea = to.path.startsWith('/auth/');

  // Storefront and landing pages are public
  if (!isAdminArea && !isAuthArea) {
    return;
  }

  // Auth pages manage their own redirects after login/setup
  if (isAuthArea) {
    return;
  }

  // Use nuxt-auth-utils session directly for SSR compatibility
  const { loggedIn, user, fetch: refreshSession } = useUserSession();

  // Check if setup is needed
  const { data: authCheck } = await useFetch('/api/auth/check', {
    key: 'auth-check',
  });

  const needsSetup = authCheck.value?.needsSetup ?? false;

  // If no users exist, redirect to setup
  if (needsSetup) {
    if (to.path !== '/auth/setup') {
      return navigateTo('/auth/setup');
    }
    return;
  }

  // Ensure session is loaded
  if (!loggedIn.value) {
    await refreshSession();
  }

  // If still not authenticated, redirect to login
  if (!loggedIn.value) {
    if (to.path !== '/auth/login') {
      return navigateTo('/auth/login');
    }
    return;
  }

  // Check admin-only routes
  const isAdminRoute = ADMIN_ONLY_ROUTES.some((route) =>
    to.path.startsWith(route)
  );
  if (isAdminRoute && (user.value as { role: string })?.role !== 'admin') {
    return navigateTo('/admin');
  }
});
