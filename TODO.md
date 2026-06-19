# TODO

Known follow-ups, deferred deliberately. None block the current build; they are
quality improvements to schedule next, surfaced by the codebase audit.

## WCAG AA contrast in the light theme (accessibility)

The dark theme passes AA. The light theme has a few contrast misses to fix:

- **Severity palette.** `web/src/lib/risk.ts` hardcodes dark-tuned severity hex that
  is reused verbatim in light mode, so the KPI numbers and the chart fills are too
  faint on white cards (major ~1.56:1, minor ~1.65:1, critical ~2.61:1).
  `web/src/index.css` already defines light severity tokens; expose theme-correct
  hex and pass it to `KpiCards`, `SeverityChart` and `RiskChart`.
- **Small accent text.** The light `--signal-300` (230,110,0) is used as text at
  ~2.5-2.9:1 in `CodeLabel`, the active nav item, `StatusTag` and the table
  case-ids; the `SeverityCell` / `Badge` count chips fail in light; and `fg-faint`
  carries real labels and chart axis ticks at ~3:1 in both themes. Darken the light
  accent (or add an accent-on-light token), render chip counts in full foreground,
  and move meaningful `fg-faint` labels to `fg-muted`.

## Tests (coverage)

Convert the `__main__` smoke blocks into pytest assertions for the scoring
calibration and monotonicity, severity normalization, RAG building-id isolation,
and the eval precision/recall/F1, so the "AI extraction evaluated" claim is
CI-checkable rather than exercised only by manual smoke runs.
