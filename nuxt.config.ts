// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxthub/core',
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
      ],
    },
  },

  hub: {
    database: true,
    kv: true,
  },

  // i18n configuration
  i18n: {
    locales: [
      { code: 'fr', name: 'Français', file: 'fr.json', dir: 'ltr' },
      { code: 'en', name: 'English', file: 'en.json', dir: 'ltr' },
      { code: 'ar', name: 'العربية', file: 'ar.json', dir: 'rtl' },
    ],
    defaultLocale: 'fr',
    lazy: true,
    langDir: 'locales',
    strategy: 'no_prefix',
    detectBrowserLanguage: false,
  },

  // Runtime config for admin operations
  runtimeConfig: {
    // Server-only (not exposed to client)
    adminSecretKey: '', // Set via NUXT_ADMIN_SECRET_KEY env var
  },

  // Pinia configuration
  pinia: {
    storesDirs: ['./app/stores/**'],
  },
});
