# BuildingLens web front-end

React SPA for the BuildingLens project. Requires the FastAPI back-end running on port 8000.

## Prerequisites

- Node.js 18 or later.
- The FastAPI back-end running (`python -m uvicorn api.main:app --port 8000`). See `api/README.md`.

## Install and run

```bash
cd web
npm install
npm run dev
```

The dev server starts on `http://localhost:5173`. It proxies every `/api/*` request to `http://localhost:8000`, so you do not need to configure CORS manually.

## Other scripts

```bash
npm run build      # type-check (tsc --noEmit) then bundle with Vite
npm run typecheck  # tsc --noEmit only, no bundle
npm run preview    # serve the production bundle locally
```

## Folder structure

```
web/
  src/
    api/
      client.ts     # typed fetch wrappers for every endpoint
      types.ts      # TypeScript interfaces (BuildingSummary, BuildingDetail, ...)
    components/
      Layout.tsx        # top nav bar and page frame (read-only)
      building/
        AskSection.tsx      # inline RAG question box on a building page
        DefectTable.tsx     # filterable defect list
        DisciplineChart.tsx # recharts bar chart: defects by discipline
        KpiCards.tsx        # risk score and defect count cards
        SeverityChart.tsx   # recharts pie chart: defects by severity
      portfolio/
        RiskChart.tsx   # recharts bar chart: buildings ranked by risk score
        SeverityCell.tsx # compact colored severity count badge
      search/
        AnswerPanel.tsx       # renders the LLM answer and source cards
        MockNoticeBanner.tsx  # banner shown when mock mode is active
        SourceCard.tsx        # one cited source snippet
    i18n/
      en.json   # English strings (default)
      fr.json   # French strings
      index.ts  # i18next initialisation (reads "lang" from localStorage)
    pages/
      BuildingPage.tsx   # /building/:id
      PortfolioPage.tsx  # /portfolio
      SearchPage.tsx     # / (home)
    App.tsx    # route definitions (read-only)
    main.tsx   # React entry point (read-only)
  index.html
  vite.config.ts  # dev proxy: /api -> http://localhost:8000
  tsconfig.json
  package.json
```

## Internationalisation

English is the default language. French is available via the EN / FR toggle in the top-right corner of the navigation bar.

Switching the language calls `i18n.changeLanguage()` and stores the choice in `localStorage` under the key `"lang"`. On the next page load that stored value is read back, so the chosen language persists across sessions.

Translation keys live in `src/i18n/en.json` and `src/i18n/fr.json`. They are read-only: do not edit them. If a page needs a string not covered by the existing keys, call `t("ns.key", "English fallback")` so the text still renders even before a translation is added.

Reading an array key:

```ts
const examples = t("search.exampleList", { returnObjects: true }) as string[];
```

## Severity colours

The app uses a consistent colour convention: red for critical defects, amber for major, and slate or green for minor. These are expressed as Tailwind utility classes and are not a global theme token.

## Notes for contributors

- The code must be type-correct with TypeScript strict mode. Avoid `any`. Run `npm run typecheck` before committing.
- Visible text must go through `t()`. Never hardcode French or other visible strings.
- Every data fetch must handle loading, error, and empty states explicitly.
- The production build is assembled by the integrator (`npm run build`) after all feature branches are merged. Do not run the build yourself while parallel pages are still in progress.
