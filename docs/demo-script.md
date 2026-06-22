# Demo script (2 to 3 minutes)

A short, recorded walkthrough of BuildingLens. The demo is a bonus, not a core
deliverable. It is recorded locally; nothing is deployed online.

## Before you record (pre-flight)

1. Build the data and the AI artifacts once:
   ```bash
   make install
   make data
   make extract        # needs a key in .env; otherwise the demo runs but defects are empty
   ```
2. Start both servers (two terminals):
   ```bash
   python -m uvicorn api.main:app --port 8000
   cd web && npm run dev          # http://localhost:5173
   ```
3. Open `http://localhost:5173` in the browser. Pick a building that has critical
   defects in advance (open the Portfolio, note the top one) so the dossier looks
   strong on camera.
4. Settings page: confirm the provider shows a real client (not mock), or set it
   to mock on purpose if you want to demo the offline path. Either is fine, just
   say which one out loud.

## Capture tool (Windows 11)

- Xbox Game Bar (built in): `Win + Alt + R` to start and stop. Output lands in
  Videos/Captures.
- Snipping Tool (Win 11) has a screen-record button.
- OBS Studio (free) if you want to frame a single window cleanly. This is the
  best looking option.
- Loom if you want an instant shareable link (it uploads to the cloud).

Record at 1080p, hide bookmarks and notifications, zoom the browser to ~110% so
text reads well in the video.

## The walkthrough (timed)

**0:00 to 0:15. The hook (Home).**
Land on the home page. Read the tagline out loud: "From raw inspection data to
actionable AI-powered building risk intelligence." One sentence on the problem:
an insurer or asset manager has a pile of inspection PDFs and cannot quickly see
which buildings carry critical defects. Point at the live data counts (buildings,
documents, defects) to show this is real data, not a mockup.

**0:15 to 0:45. Portfolio (the stock at a glance).**
Click "Browse the portfolio". Show the KPIs (total buildings, total defects,
critical count) and the risk chart. Say that every building is ranked by a single
0 to 100 risk score. Sort or point to the highest-risk building, then click it.

**0:45 to 1:25. Building dossier (one building in depth).**
On the building page, point out:
- The identity block: real EUBUCCO footprint, real commune, the SOURCE tag.
- The locator map (real coordinates).
- The risk score and the critical / major / minor breakdown.
- The defect table: each defect has a discipline, a severity, and you can sort
  and filter. Say one line: the building location is real, its condition is
  synthetic for the demo, and a real SECO report would drop in unchanged.

**1:25 to 1:55. Ask a building (grounded Q&A).**
In the building's Ask bar, type a question like "what are the most serious
defects here?". Show the answer streaming in, then point at the citations: the
answer only uses the report text and cites the passages it came from.

**1:55 to 2:35. Search console (portfolio-wide, scoped).**
Go to Search. Set a scope facet (for example a commune or severity = critical),
and show the live "N of M buildings" count. Ask a portfolio question like "which
buildings have critical structural defects?". Show the streaming answer with
sources, and that the scope narrowed the search. Optional: navigate away to
another page and back to show the conversation is still there (the page cache).

**2:35 to 3:00. Settings and close.**
Open Settings. Show the provider switch (Anthropic, OpenAI, Mistral, Ollama,
mock) and the live connection test. One closing line: the whole thing runs on
public data, is reproducible from zero with `make data && make run`, and runs
offline in mock mode with no API key.

## Notes

- If you recorded in mock mode, say so: answers are deterministic fixtures, not a
  live model.
- Keep it moving. If a step is slow (first RAG query warms the embeddings), cut
  the dead time in editing.
