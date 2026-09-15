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

    tabs: {
      variants: {
        variant: {
          outline: {
            list: 'bg-elevated rounded-lg',
            indicator: 'inset-y-1 rounded-md ring ring-inset ring-primary/50',
            trigger: [
              'grow data-[state=active]:text-primary',
              'hover:data-[state=active]:not-disabled:bg-primary/10',
              'outline-primary/25 focus-visible:outline-3',
            ].join(' '),
          },
        },
      },
    },
  },
})
