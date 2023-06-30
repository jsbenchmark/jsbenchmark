// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ["@vueuse/nuxt", "@nuxtjs/tailwindcss"],
  ssr: false,

  app: {
    head: {
      link: [
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Pathway+Extreme:wght@400;500;600;700;800&display=swap",
          crossorigin: "anonymous",
        },
      ],
    },
  },
});
