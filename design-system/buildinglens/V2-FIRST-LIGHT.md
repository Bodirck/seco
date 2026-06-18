# BuildingLens v2 design system: "First Light"

A dark, futuristic, refined (epure) interface in the spirit of a modern spy-tech HUD.
Restraint is the rule: deep space, hairline structure, one electric accent used sparingly,
precise typography, generous negative space. Neon and glow are seasoning, not the meal.

This file is the single source of truth for the v2 look. Every component must use the tokens and
primitives below. Do not introduce new colors, fonts, or one-off styles.

## Principles

1. Epure first. Most surfaces are flat. Whitespace and alignment carry the design, not decoration.
2. One accent. Cyan (`signal`) marks what is interactive or important. Everything else is ink and slate.
3. Hairlines, not boxes. Structure comes from 1px `line` borders and subtle elevation, not heavy shadows.
4. Data is monospaced. Numbers, scores, ids and citations use the mono family for a precise, instrument feel.
5. Glow with intent. A faint accent glow appears on hover and focus only. Never ambient neon everywhere.
6. Motion is quick and physical. 150-250ms ease-out, opacity and small translate only, reduced-motion respected.

## Color tokens (Tailwind classes)

Dark only. `color-scheme: dark`. All defined in `web/tailwind.config.js`.

| Token | Hex | Tailwind | Use |
|-------|-----|----------|-----|
| ink-950 | #05070D | `bg-ink-950` | page background (deepest) |
| ink-900 | #090D17 | `bg-ink-900` | app base background |
| ink-850 | #0D131F | `bg-ink-850` | card surface |
| ink-800 | #111827 | `bg-ink-800` | raised surface, inputs |
| ink-700 | #18202F | `bg-ink-700` | hover / raised-2 |
| line | #1B2433 | `border-line` | default hairline border |
| line-strong | #2A3650 | `border-line-strong` | emphasized divider |
| fg | #E7EEF8 | `text-fg` | primary text |
| fg-muted | #9AA7BD | `text-fg-muted` | secondary text |
| fg-faint | #61708A | `text-fg-faint` | labels, tertiary |
| signal-300 | #67E8F9 | `text-signal-300` | accent text on dark |
| signal-400 | #22D3EE | `*-signal-400` | accent highlight, focus ring |
| signal-500 | #06B6D4 | `bg-signal-500` | primary button fill |
| signal-600 | #0891B2 | `bg-signal-600` | primary button hover-pressed |
| critical | #FB5E6B | `text-critical` / `bg-critical/15` | critical severity, high risk |
| major | #F5B544 | `text-major` / `bg-major/15` | major severity, medium risk |
| minor | #34D399 | `text-minor` / `bg-minor/15` | minor severity, low risk |

Opacity modifiers work on the custom colors (e.g. `bg-critical/15`, `border-signal-400/40`, `shadow-signal-500/20`).

Severity convention is unchanged in meaning: critical = red, major = amber, minor = green (now tuned for dark).
Risk thresholds: score >= 70 = critical color, >= 40 = major color, else minor color.

## Typography

Loaded via Google Fonts in `web/src/index.css`. Tailwind families in `web/tailwind.config.js`.

- Display / UI: **Space Grotesk** (`font-display`). H1-H3, nav, button labels, KPI labels, section titles.
- Body: **Inter** (`font-sans`, the default on `body`). Paragraphs, descriptions, answers, table cells.
- Mono / data: **JetBrains Mono** (`font-mono`). Risk scores, counts, building ids, doc ids, citations, code.

Use `tabular-nums` on any changing number. Headings are tight (`tracking-tight`); small uppercase labels use
`tracking-wide` or `tracking-widest` (`text-xs font-medium uppercase text-fg-faint`) for the HUD label feel.

## Surfaces and effects

- Card: `bg-ink-850 border border-line rounded-xl`. Interactive cards add on hover:
  `hover:border-signal-400/40 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.15),0_8px_30px_-12px_rgba(34,211,238,0.25)]`
  with `transition`. Keep padding generous (p-5 / p-6).
- HUD corner ticks: only on the hero and at most one or two signature panels. Small L-shaped accent marks in the
  corners (1px, signal-400/40). Never on every card (that is not epure).
- Background texture: a single very faint radial glow (signal at < 6% opacity) behind the landing hero, and an
  optional fixed fine grid at ~3% opacity on ink-950. Subtle enough to read as atmosphere, not pattern.
- Focus: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70`. Always visible.
- Dividers: `border-line`. Section separators are hairlines, not filled bars.

## Components (the contract, build to these exact signatures)

Live under `web/src/components/ui/`, re-exported from `web/src/components/ui/index.ts` (a barrel that also
re-exports the existing `Tooltip`, `InfoTip`, `LocatorMap`). Pages import from `"../components/ui"`.

- `Card`: `({ className?, interactive?, children })` -> styled div. `interactive` adds the hover glow.
- `Button`: `({ variant?: "primary"|"secondary"|"ghost", size?: "sm"|"md", href?, ...rest })`. Renders `<a>` when
  `href` is set, else `<button>`. primary = `bg-signal-500 text-ink-950 hover:bg-signal-400` + faint glow;
  secondary = `border border-line text-fg hover:border-signal-400/60 hover:text-signal-300`; ghost = text only.
  Always `cursor-pointer`, focus ring, disabled = `opacity-50 cursor-not-allowed`. Optional `leftIcon` slot.
- `Input` / `Textarea`: `({ label?, hint?, error?, ...rest })`, forwardRef. `bg-ink-800 border border-line
  rounded-lg text-fg placeholder-fg-faint focus ring signal`. Label is a small uppercase faint label.
- `Badge`: `({ tone?: "critical"|"major"|"minor"|"signal"|"neutral", children })` -> pill, `bg-<tone>/15 text-<tone>`
  (neutral = `bg-ink-700 text-fg-muted`). Mono, tabular-nums when it wraps a number.
- `Spinner`: `({ size?: "sm"|"md" })` -> signal-colored spinner.
- `EmptyState`: `({ title, description, action? })` -> centered, faint icon, title (display), muted description,
  optional `<Button>` action.
- `PageHeader`: `({ title, meta?, actions?, kicker? })` -> H1 (display, text-fg), optional small uppercase `kicker`
  above it, optional `meta` line (muted) and right-aligned `actions`.
- `Section`: `({ title, tip?, actions?, children })` -> a titled block: small display heading with an optional
  `<InfoTip text={tip}/>` and optional right `actions`, then children.

## Data visualization (recharts on dark)

- Grid: `stroke="#1B2433"`. Axis ticks: `fill="#61708A"`, fontSize 11, no axis lines.
- Bars / lines: use `signal-400` (#22D3EE) for neutral series; for risk-colored bars use the risk thresholds.
- Donut severity: critical #FB5E6B, major #F5B544, minor #34D399.
- Tooltip `contentStyle`: `{ background:"#0D131F", border:"1px solid #2A3650", borderRadius:8, color:"#E7EEF8" }`.
- The building risk score is the hero metric: render it as a prominent radial gauge or a large mono figure with a
  thin signal arc, with its severity color by threshold.

## Accessibility

- Body text (`text-fg` on ink) exceeds 12:1. `text-fg-muted` stays >= 4.5:1; never put body copy on `text-fg-faint`.
- Accent text on dark uses `signal-300`; `signal-400/500` are for fills, borders, icons, large text.
- Every icon-only control has an `aria-label`. Focus rings are never removed. `prefers-reduced-motion` is honored
  globally in `index.css`.

## Anti-patterns (do NOT)

- No light surfaces, no white cards, no leftover slate-50/white-bg classes from v1.
- No ambient neon, no glow on static elements, no more than one accent hue.
- No emoji icons (inline SVG only). No em-dashes or en-dashes anywhere.
- No heavy drop shadows; structure is hairlines + faint glow.
- No hardcoded user-facing strings: everything through i18n (`t()`), keys in both `en.json` and `fr.json`.
