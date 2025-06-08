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

  plausible: {
    domain: 'jsbenchmark.com',
    proxy: true,
    apiHost: 'https://reasonable.pabue.workers.dev',
  },

  colorMode: {
    preference: 'dark',
  },

  compatibilityDate: '2024-11-22',
})
