export default defineAppConfig({
  ui: {
    primary: 'salmon',
    gray: 'zinc',

    safelistColors: ['primary'],

    button: {
      default: {
        loadingIcon: 'i-tabler-loader',
      },
    },

    input: {
      size: { xl: 'text-xl' },
    },
    textarea: {
      size: { '4xl': 'text-4xl leading-[1.4]' },
    },
  },
})
