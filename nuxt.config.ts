// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt',
    '@pinia/nuxt'
  ],

  // Admin panel is a token-authenticated SPA (access token lives in memory, refresh in localStorage).
  // SSR is disabled so there is no server-side rendering that could leak tokens or double-fetch.
  ssr: false,

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      // Spectre backend host (no trailing slash). Override with NUXT_PUBLIC_API_BASE.
      apiBase: 'https://spectra.diamonderp.uz',
      siteUrl: 'https://spectra.diamonderp.uz'
    }
  },

  compatibilityDate: '2026-06-30'

  // eslint: {
  //   config: {
  //     stylistic: {
  //       commaDangle: 'never',
  //       braceStyle: '1tbs'
  //     }
  //   }
  // }
})
