export default defineAppConfig({
  ui: {
    colors: {
      primary: 'salmon',
      neutral: 'zinc',
    },

    icons: {
      loading: 'i-tabler-loader',
    },

    input: {
      variants: {
        size: {
          xl: {
            base: 'text-xl',
          },
        },
      },
    },
    textarea: {
      variants: {
        size: {
          '4xl': {
            base: 'text-4xl leading-[1.4]',
          },
        },
      },
    },

    tooltip: {
      slots: {
        content: 'dark:bg-zinc-800 dark:ring-zinc-700',
      },
    },
  },
})
