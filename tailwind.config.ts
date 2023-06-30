import colors from "tailwindcss/colors";
import defaultTheme from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  content: [],
  theme: {
    extend: {
      colors: {
        gray: colors.zinc,
      },

      fontFamily: {
        mono: ["JetBrains Mono Variable", ...defaultTheme.fontFamily.mono],
        sans: ["Pathway Extreme", ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};
