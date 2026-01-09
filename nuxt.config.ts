// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxthub/core', // Uses local SQLite in development
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxtjs/tailwindcss',
    'nuxt-auth-utils',
    '@pinia/nuxt',
    '@nuxtjs/i18n',
  ],

  // App metadata
  app: {
    head: {
      title: 'Atlas Inventory',
      titleTemplate: '%s | Atlas Inventory',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Système de gestion d\'inventaire professionnel' },
        { name: 'theme-color', content: '#4F46E5' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/branding/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/branding/favicon-32.png' },
        { rel: 'apple-touch-icon', href: '/branding/apple-touch-icon.png' },
        { rel: 'manifest', href: '/manifest.json' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap' },
      ],
      // Inline script to set direction immediately based on cookie (prevents flicker)
      script: [
        {
          innerHTML: `(function(){var c=document.cookie.match(/i18n_redirected=([^;]+)/);var l=c?c[1]:'fr';document.documentElement.dir=l==='ar'?'rtl':'ltr';document.documentElement.lang=l;})()`,
          type: 'text/javascript',
        },
      ],
    },
  },

  // NuxtHub uses local SQLite in development mode
  hub: {
    database: true,
    // kv: true, // Disabled - not needed
  },

  // Session configuration for network access
  nitro: {
    experimental: {
      openAPI: true,
    },
  },

  // i18n configuration
  i18n: {
    locales: [
      { code: 'fr', name: 'Français', file: 'fr.json', dir: 'ltr' },
      { code: 'en', name: 'English', file: 'en.json', dir: 'ltr' },
      { code: 'ar', name: 'العربية', file: 'ar.json', dir: 'rtl' },
    ],
    defaultLocale: 'fr',
    langDir: 'locales',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      alwaysRedirect: false,
      fallbackLocale: 'fr',
    },
  },

  // Runtime config for admin operations
  runtimeConfig: {
    // Server-only (not exposed to client)
    adminSecretKey: '', // Set via NUXT_ADMIN_SECRET_KEY env var
    session: {
      cookie: {
        sameSite: 'lax',
        secure: false, // Set to true in production with HTTPS
      },
    },
  },

  // Pinia configuration
  pinia: {
    storesDirs: ['./app/stores/**'],
  },
});
