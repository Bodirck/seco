/** @type {import('tailwindcss').Config} */
// Colors resolve to CSS variables (space-separated RGB triplets) so the whole app
// switches between the dark and light "CLASSIFIED" palettes by toggling a class on
// <html>, with no component changes. See web/src/index.css for the two palettes.
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
        // Primary accent: orange. signal-* keeps its name so V2 components still work.
        signal: {
          300: v("--signal-300"),
          400: v("--signal-400"),
          500: v("--signal-500"),
          600: v("--signal-600"),
          700: v("--signal-700"),
        },
        // Secondary highlight: amber, for key labels and status.
        amber: {
          DEFAULT: v("--amber"),
          300: v("--amber-300"),
        },
        // Text/icon color to place on an orange fill (dark, both themes).
        onaccent: v("--onaccent"),
        critical: v("--critical"),
        major: v("--major"),
        minor: v("--minor"),
      },
      fontFamily: {
        // Condensed display for titles, labels and case numbers (use uppercase + tracking).
        display: ['"Oswald"', '"Arial Narrow"', "ui-sans-serif", "sans-serif"],
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        signal:
          "0 0 0 1px rgb(var(--signal-400) / 0.20), 0 8px 30px -12px rgb(var(--signal-400) / 0.35)",
      },
      keyframes: {
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        "panel-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        scanline: "scanline 3.5s linear infinite",
        "panel-in": "panel-in 280ms ease-out both",
      },
    },
  },
  plugins: [],
};
