import colors from "tailwindcss/colors";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // First Light v2 dark system (see design-system/buildinglens/V2-FIRST-LIGHT.md)
        ink: {
          950: "#05070D",
          900: "#090D17",
          850: "#0D131F",
          800: "#111827",
          700: "#18202F",
        },
        line: {
          DEFAULT: "#1B2433",
          strong: "#2A3650",
        },
        fg: {
          DEFAULT: "#E7EEF8",
          muted: "#9AA7BD",
          faint: "#61708A",
        },
        signal: {
          300: "#67E8F9",
          400: "#22D3EE",
          500: "#06B6D4",
          600: "#0891B2",
          700: "#0E7490",
        },
        critical: "#FB5E6B",
        major: "#F5B544",
        minor: "#34D399",
        // v1 tokens kept available during the dark conversion; not used by v2 components
        brand: colors.blue,
        accent: colors.emerald,
      },
      fontFamily: {
        display: ['"Space Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        signal:
          "0 0 0 1px rgba(34,211,238,0.15), 0 8px 30px -12px rgba(34,211,238,0.25)",
      },
    },
  },
  plugins: [],
};
