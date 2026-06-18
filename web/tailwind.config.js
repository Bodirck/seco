/** @type {import('tailwindcss').Config} */
// Colors resolve to CSS variables (space-separated RGB triplets) so the whole app
// can switch between the dark ("First Light") and light themes by toggling a class
// on <html>, with no component changes. See web/src/index.css for the two palettes.
const v = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: v("--ink-950"),
          900: v("--ink-900"),
          850: v("--ink-850"),
          800: v("--ink-800"),
          700: v("--ink-700"),
        },
        line: {
          DEFAULT: v("--line"),
          strong: v("--line-strong"),
        },
        fg: {
          DEFAULT: v("--fg"),
          muted: v("--fg-muted"),
          faint: v("--fg-faint"),
        },
        signal: {
          300: v("--signal-300"),
          400: v("--signal-400"),
          500: v("--signal-500"),
          600: v("--signal-600"),
          700: v("--signal-700"),
        },
        // Text/icon color to place on a signal fill (always readable per theme).
        onaccent: v("--onaccent"),
        critical: v("--critical"),
        major: v("--major"),
        minor: v("--minor"),
      },
      fontFamily: {
        display: ['"Space Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        signal:
          "0 0 0 1px rgb(var(--signal-400) / 0.18), 0 8px 30px -12px rgb(var(--signal-400) / 0.30)",
      },
    },
  },
  plugins: [],
};
