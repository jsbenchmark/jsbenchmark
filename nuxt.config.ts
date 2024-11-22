// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@vueuse/nuxt', '@nuxt/ui', '@nuxtjs/plausible'],
  ssr: true,

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

  ui: {
    icons: ['tabler'],
  },

  plausible: {
    domain: 'jsbenchmark.com',
  },

  colorMode: {
    preference: 'dark',
  },

  compatibilityDate: '2024-11-22',
})