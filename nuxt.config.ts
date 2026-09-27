// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@vueuse/nuxt', '@nuxt/ui', '@nuxtjs/plausible'],
  css: ['~/assets/css/main.css'],
  ssr: true,

  nitro: {
    // Chroma registers color parsers and interpolators through import side effects.
    // Keep them when Cloudflare bundles dependencies into the server worker.
    moduleSideEffects: ['chroma-js'],
  },

  ui: {
    fonts: false,
  },

  app: {
    head: {
      link: [
        {
          rel: 'icon',
          type: 'image/svg+xml',
          href: '/logo.svg',
        },
      ],
    },
  },

  runtimeConfig: {
    public: {
      workerUrl: '',
    },
  },

  plausible: {
    domain: 'jsbenchmark.com',
    proxy: true,
    apiHost: 'https://reasonable.pabue.workers.dev',
  },

  colorMode: {
    preference: 'system',
    fallback: 'light',
  },

  compatibilityDate: '2024-11-22',
})
