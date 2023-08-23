// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@vueuse/nuxt', '@nuxtjs/tailwindcss'],
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
      script: [
        {
          defer: true,
          'data-domain': 'jsbenchmark.com',
          src: 'https://reasonable.pabue.workers.dev/js/script.pageview-props.js',
        },
      ],
    },
  },
})
