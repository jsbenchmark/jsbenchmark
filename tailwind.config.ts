import colors from 'tailwindcss/colors'
import defaultTheme from 'tailwindcss/defaultTheme'

export default {
  content: [],
  theme: {
    extend: {
      colors: {
        gray: colors.zinc,
        salmon: {
          '50': '#fff4f1',
          '100': '#ffe7e1',
          '200': '#ffd3c7',
          '300': '#ffb4a0',
          '400': '#ff8362',
          '500': '#f8633b',
          '600': '#e5471d',
          '700': '#c13814',
          '800': '#a03114',
          '900': '#842f18',
          '950': '#481507',
        },
      },

      fontFamily: {
        mono: ['JetBrains Mono Variable', ...defaultTheme.fontFamily.mono],
        sans: ['Pathway Extreme Variable', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [require('@headlessui/tailwindcss')],
}
