# BuildingLens v3 design system: "CLASSIFIED"

A spy-tech HUD, an intelligence-agency terminal. Buildings are presented as classified dossiers.
Modular rectangular panels in an asymmetric grid, like stacked windows, with highlighted title bars
and window controls. Bright orange and amber accents on title bars and key labels, light body text on a
midnight base. Decorative alphanumeric codes and technical micro-text. A fine dot grid and faint map/circuit
traces in the background. Restraint still applies: the chrome serves the data, it does not bury it.

This supersedes the cyan "First Light" palette (V2). The token NAMES are unchanged, so most of the re-skin is the
palette + typography swap; the dossier chrome is new component work. Light and dark themes both ship.

## Principles

1. Dossier, not dashboard. Each building reads like a classified file: a big case number, a code label, status, data fields.
2. Windowed panels. Content sits in rectangular panels with an accent title bar (a code label + window buttons _ box X).
3. One accent family. Orange (#FF7A00) is primary; amber (#FFB02E) is the secondary highlight. Nothing else competes.
4. Technical texture. Alphanumeric IDs, "CASEFILE //", "GEO INTEL", "STATUS:", "SECTOR 03", faint micro-text footers.
5. Decode and scan. Subtle text decode on reveal, sequential panel entrance, a slow scan line. Always respect reduced-motion.
6. Legible first. Light text on midnight; accents are for chrome and labels, never long body copy.

## Color tokens (Tailwind classes, CSS variables; both themes in web/src/index.css)

Names are unchanged from V2 so components keep working; `signal` is now ORANGE, and `amber` is new.

| Token | Dark | Light | Use |
|-------|------|-------|-----|
| ink-950 | #0A0E1A | #F4F5F7 | page background |
| ink-900 | #0A0E1A | #F4F5F7 | app base |
| ink-850 | #161A33 | #ECEEF2 | panel surface (dark blue-violet / light grey) |
| ink-800 | #1E2240 | #E2E5EC | raised, inputs, title-bar base |
| ink-700 | #262B4D | #D5D9E2 | hover |
| line | #2A3052 | #D5D9E2 | hairline border |
| line-strong | #3D4570 | #B8BECC | strong divider |
| fg | #E8ECF5 | #14182A | primary text |
| fg-muted | #9AA3BD | #4A5168 | secondary text |
| fg-faint | #626C8A | #7A8199 | micro-text, labels |
| signal-500 | #FF7A00 | #E66E00 | PRIMARY accent (title bars, buttons, active) |
| signal-400 | #FF8C1A | #FF7A00 | accent highlight, focus ring |
| signal-300 | #FFA64D | #CC6200 | accent text on surfaces |
| signal-600 | #E66E00 | #CC6200 | accent hover/pressed |
| amber (DEFAULT) | #FFB02E | #B5781A | secondary highlight, key labels, status |
| onaccent | #0A0E1A | #0A0E1A | text on an orange fill (dark, both themes) |
| critical / major / minor | #FB5E6B / #F5B544 / #34D399 | #DC2626 / #B5781A / #059669 | severity (unchanged meaning) |

Opacity modifiers work (e.g. `bg-signal-500/15`, `text-amber`, `border-signal-400/40`).

## Typography

Loaded in web/src/index.css. Families in web/tailwind.config.js.

- Display / titles / labels / codes: **Oswald** (`font-display`), CONDENSED. Use UPPERCASE with strong tracking
  (`uppercase tracking-wide` or `tracking-[0.2em]`) for titles, labels and codes. Big case numbers use Oswald at large sizes.
- Body: **Inter** (`font-sans`, default on body). Paragraphs, descriptions, answers, table cells.
- Data / mono: **JetBrains Mono** (`font-mono`). Alphanumeric IDs, scores, counts, coordinates, citations. Use `tabular-nums`.

## Panel anatomy (the signature element)

A `Panel` is a rectangular module:
- Title bar: a thin bar tinted with the accent (orange by default, amber variant), containing a left CODE LABEL
  (Oswald uppercase, e.g. "CASEFILE // B-047" or "GEO INTEL") and, on the right, decorative window controls (three small
  glyphs: a minus, a square, an X) drawn as inline SVG, non-interactive (aria-hidden).
- Body: `bg-ink-850 border border-line`, square or barely-rounded corners (rounded-sm or rounded-none for the HUD feel).
- Footer micro-text (optional): faint Oswald/mono technical string at the bottom (e.g. "REF 0xA7 // SECTOR 03 // VERIFIED").

## Decorative codes

Provide a small helper (web/src/lib/dossier.ts) to derive stable codes from a building id:
- `caseId(id)` -> e.g. "B-047" (zero-padded), `sector(id)` -> "SECTOR 03" (id modulo a few sectors).
- Labels used as constants: "CASEFILE //", "GEO INTEL", "RISK INDEX", "DEFECT LOG", "QUERY //", "OPS // SETTINGS",
  "INTAKE // INGEST", "STATUS:". These are UI chrome, in English, not translated (codes), but any human-readable label
  next to them goes through i18n.

## Per-building dossier

- A large `DossierNumber` (Oswald display, the case sequence or id).
- A `ScanFrame`: a stylized "3D scan" visual placeholder (blue-white, high-exposure, wireframe / point-cloud feel) drawn with
  CSS/SVG (a wireframe building or a point grid with scan lines). We have NO real building photos (public footprints only), so
  this is an honest stylized placeholder, not a real render. Keep it clearly decorative.
- Name, location, big case number, and data fields as a labelled list: YEAR, ARCHITECT (unknown -> "N/A"), HEIGHT, STATUS,
  plus the existing risk score and defect breakdown. Field labels in Oswald uppercase amber/faint; values in mono.

## Animations (subtle, reduced-motion aware)

- `DecodeText`: on mount, briefly scramble/reveal the characters (or a quick typewriter) then settle. Under
  prefers-reduced-motion, render the final text instantly.
- Sequential panel reveal: panels fade/translate up with a small stagger (30-60ms each). Reduced-motion -> appear instantly.
- Scan line: a slow vertical sweep overlay on the dossier scan frame and the hero. Reduced-motion -> no sweep.
- Keep durations 150-400ms; never block interaction.

## Components to build (contract; under web/src/components/ui unless noted)

- `Panel({ code?, title?, accent?: "orange" | "amber", windowButtons?: boolean, footer?: string, className?, children })`.
- `DossierNumber({ value: string | number, className? })` -> big Oswald display number.
- `CodeLabel({ children, accent?: "orange" | "amber" })` -> Oswald uppercase tracked label in the accent.
- `StatusTag({ label, tone?: "critical" | "major" | "minor" | "signal" | "neutral" })` -> "STATUS:" style tag.
- `DecodeText({ text, className?, as? })` -> animated reveal, reduced-motion safe.
- `ScanFrame({ label?, children?, className? })` -> the blue-white scan visual placeholder.
- `web/src/lib/dossier.ts` -> caseId / sector / shared code constants.
- Keep the existing primitives (Card, Button, Input, Badge, Spinner, EmptyState, PageHeader, Section, Tooltip, LocatorMap);
  restyle them via the new tokens. Button primary is now orange. The locator map is the "GEO INTEL" panel.

## Light / dark

Dark is the default identity (midnight blue, orange/amber, light text). Light is the clear variant (pale grey panels, dark
text, slightly darkened orange for contrast). The existing header toggle (top right) switches them; both must stay legible
(4.5:1 for body text). Orange title bars use the `onaccent` dark text in both themes.

## Anti-patterns

- No cyan left over from V2. No more than the orange + amber accent family.
- No neon overload: chrome and codes are accents, not the whole surface. Micro-text stays faint and small.
- No emojis as icons (inline SVG only). No em-dash or en-dash anywhere. All human-readable copy via i18n.
- Decorative codes (CASEFILE //, SECTOR 03, IDs) are not translated; they are chrome.
