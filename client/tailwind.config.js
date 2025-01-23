const { heroui } = require("@heroui/react"); // eslint-disable-line

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    fontFamily: {
      sans: ["Inter", "-apple-system", "system-ui", "sans-serif"],
    },
    screens: {
      "sm": "640px",
      // => @media (min-width: 640px) { ... }

      "md": "768px",
      // => @media (min-width: 768px) { ... }

      "lg": "1024px",
      // => @media (min-width: 1024px) { ... }

      "xl": "1280px",
      // => @media (min-width: 1280px) { ... }

      "2xl": "1536px",
      // => @media (min-width: 1536px) { ... }
    },
    extend: {},
  },
  darkMode: "class",
  plugins: [
    heroui({
      prefix: "nextui",
      addCommonColors: false,
      defaultTheme: "light",
      defaultExtendTheme: "light",
      layout: {},
      themes: {
        light: {
          layout: {}, // light theme layout tokens
          colors: {
            primary: {
              100: "#CBEAFD",
              200: "#98E7FB",
              300: "#64CFF5",
              400: "#3DA8EB",
              500: "#048BDE",
              600: "#0276BE",
              700: "#02639F",
              800: "#014F80",
              900: "#00416A",
              DEFAULT: "#048BDE",
            },
            secondary: {
              100: "#FEEDD9",
              200: "#FDD6B3",
              300: "#FAB98C",
              400: "#F69C6F",
              500: "#F17041",
              600: "#CF4F2F",
              700: "#AD3220",
              800: "#8B1B14",
              900: "#730C0D",
              DEFAULT: "#F17041",
            },
            blue: {
              100: "#CBEAFD",
              200: "#98E7FB",
              300: "#64CFF5",
              400: "#3DA8EB",
              500: "#048BDE",
              600: "#0276BE",
              700: "#02639F",
              800: "#014F80",
              900: "#00416A",
              DEFAULT: "#048BDE",
            },
            purple: {
              100: "#FEEDD9",
              200: "#FDD6B3",
              300: "#FAB98C",
              400: "#F69C6F",
              500: "#F17041",
              600: "#CF4F2F",
              700: "#AD3220",
              800: "#8B1B14",
              900: "#730C0D",
              DEFAULT: "#F17041",
            },
            content1: {
              DEFAULT: "#FFFFFF"
            },
            content2: {
              DEFAULT: "#F2F6FC"
            }
          }, // light theme colors
        },
        dark: {
          layout: {}, // dark theme layout tokens
          colors: {
            primary: {
              100: "#CBEAFD",
              200: "#98E7FB",
              300: "#64CFF5",
              400: "#3DA8EB",
              500: "#048BDE",
              600: "#0276BE",
              700: "#02639F",
              800: "#014F80",
              900: "#00416A",
              DEFAULT: "#048BDE",
            },
            secondary: {
              100: "#FEEDD9",
              200: "#FDD6B3",
              300: "#FAB98C",
              400: "#F69C6F",
              500: "#F17041",
              600: "#CF4F2F",
              700: "#AD3220",
              800: "#8B1B14",
              900: "#730C0D",
              DEFAULT: "#F17041",
            },
            blue: {
              100: "#CBEAFD",
              200: "#98E7FB",
              300: "#64CFF5",
              400: "#3DA8EB",
              500: "#048BDE",
              600: "#0276BE",
              700: "#02639F",
              800: "#014F80",
              900: "#00416A",
              DEFAULT: "#048BDE",
            },
            purple: {
              100: "#FEEDD9",
              200: "#FDD6B3",
              300: "#FAB98C",
              400: "#F69C6F",
              500: "#F17041",
              600: "#CF4F2F",
              700: "#AD3220",
              800: "#8B1B14",
              900: "#730C0D",
              DEFAULT: "#F17041",
            },
            background: {
              DEFAULT: "#04080b",
            },
            content1: {
              DEFAULT: "#09151C"
            },
            content2: {
              DEFAULT: "#070d13"
            },
          }, // dark theme colors
        },
      },
    })
  ]
}

