# BuildingLens

[English](#english) | [Français](#français)

A take-home challenge built for SECO (AI & Data Engineer). BuildingLens turns technical building inspection reports (unstructured PDFs) and public building data (open registries) into an actionable risk view for an asset manager or a building insurer. It extracts defects from reports, scores each building's risk, and lets you query the whole stock in plain language with cited sources, on a reproducible demo corpus of 40 inspected buildings.

---

## English

### One-paragraph pitch

An insurer or an asset manager sitting on a pile of inspection reports cannot quickly answer a simple question: which buildings in my portfolio carry critical defects, and what are they? The reports are rich but unstructured, so the risk stays locked inside PDFs. BuildingLens reads those reports, pulls out every defect with its severity and a verbatim citation, rolls each building up into a single risk score, and exposes a natural-language Q&A that answers only from the source text and tells you when it does not know. It runs end to end on public data over a demo corpus of 40 inspected buildings, it is fully reproducible from zero, and it runs offline in a mock mode with no API key.

### 1. What problem, and for whom?

The user is an **asset manager or a building insurer**. The concrete pain point: today they cannot get a fast, portfolio-wide answer to "which of my buildings have critical defects, and which ones?" because the answer lives in dozens of phased inspection reports written in prose, not in a queryable structure.

BuildingLens addresses this with three things working together:

1. **Defect extraction.** One inspection PDF becomes a structured list of defects, each with `element`, `description`, `location`, `severity` (critical / major / minor) and a `citation` (the verbatim snippet from the report that justifies it).
2. **Risk scoring.** The defects of a building are aggregated into a single 0 to 100 risk score, plus the count of critical / major / minor findings, so a whole stock can be ranked at a glance.
3. **RAG Q&A with citations.** You can ask, in French or English, things like "what are the critical defects of building X?" or "which buildings have a fire risk?". Answers are grounded only in the retrieved report text, each answer cites the source blocks it used, and the model is instructed to say it does not know rather than invent.

The framing deliberately starts from the pain (risk invisible inside unstructured documents) and works backward to the technology, not the other way around.

### 2. Why is this relevant to SECO?

SECO is an independent technical-control and engineering body for construction (founded 1934 in Belgium, SECO Luxembourg since 1987, around 12,500 structures inspected over its history). Its core business, building technical control, is exactly the upstream of the decennial and biennial insurance guarantee: SECO produces the initial report for the insurer plus the inspection notes that form the basis of risk assessment.

That business generates large volumes of technical data (phased inspection reports, observation synthesis tables by discipline, defect photos, measurements, BIM scans) that today remain largely underexploited. There is no search or RAG over the reports and no defect model on top of them. That gap is precisely this challenge's pain point.

BuildingLens speaks directly to SECO's value chain:

- The defect-by-discipline structure it produces mirrors SECO's own observation synthesis tables, where each finding is tagged by discipline and rated.
- The insurer touchpoint is the natural home for a **machine-readable risk signal** instead of a PDF, which is how a control service turns into a data partnership.
- SECO's historical corpus (thousands of inspected structures) is a uniquely structurable, proprietary dataset: time-stamped observations tagged by discipline and linked to plans and standards. It is one of construction's cleanest "unstructured to structured" problems.

The severity taxonomy is anchored to public, recognised scales (RICS C1/C2/C3 condition ratings as the canonical three classes, with ASTM E2018 and Eurocode consequence classes CC1/CC2/CC3 cited as additional public vocabulary).

### 3. What data sources, and why?

BuildingLens runs on **public, reproducible data only**, combining three real Luxembourg sources with one synthetic layer. Everything can be re-fetched or regenerated from scratch by the pipeline.

| Source | Type / format | Role | License |
|---|---|---|---|
| **EUBUCCO v0.2 (Luxembourg, `nuts_id=LU00`)** | Structured, per building, Parquet (geometry as WKB, EPSG:3035), anonymous S3 download | Per-building anchor: real footprints, coordinates, footprint area, height, plus model-estimated use and floors. Populates the `buildings` table | Mixed per building, stored in `buildings.source`: national LOD1 cadastre (gov-luxembourg, around 77%) is CC0; OpenStreetMap (around 13%) is ODbL (attribution and share-alike); Microsoft (around 10%) |
| **STATEC "Autorisations de bâtir" (building permits)** | Structured, aggregated, labelled CSV via the LUSTAT SDMX REST API (no key) | Sector context only: permit trends by canton and type. Never joined to individual buildings. Satisfies the brief's second heterogeneous source | CC0 |
| **ACT commune boundaries (Luxembourg)** | Structured polygons, GeoJSON, EPSG:4326, committed in-repo (around 1 MB) | Recovers the real commune of each building by point-in-polygon on its centroid (EUBUCCO only carries a coarse code, not a name) | CC0 |
| **Synthetic inspection reports** | Unstructured PDF (generated with ReportLab) | The inspection corpus that feeds extraction and RAG | Generated by the project |

Why these: EUBUCCO is the best open per-building attribute source for Luxembourg (around 186,000 buildings in the LU subset), giving real geometry and height at country scale with no account. STATEC gives official sector context that is machine-readable and pinnable (dataflows plus `startPeriod`) without claiming per-building precision. The ACT boundaries recover a real administrative attribute (the commune) that EUBUCCO does not name, and they are committed in-repo so the build stays offline and byte-for-byte reproducible.

**Real vs synthetic (stated honestly, and encoded in the schema comments):**

- **Real, per building:** footprint geometry and coordinates (100% coverage), footprint area in m² computed from the real outline, and the commune resolved by point-in-polygon. Height is real (cadastre / LOD1) for around 78% of buildings and ML-estimated for around 22%, with the source flagged.
- **Real but model-estimated (labelled "estimated" in the UI):** use type and subtype (part ML-estimated, part OpenStreetMap), floors (regression, stored rounded). Construction year is effectively absent in the LU subset and treated as unreliable.
- **Synthetic:** building name, street, number and postcode (EUBUCCO provides none for Luxembourg), and the inspection reports themselves with every defect in them. So a building's **location and footprint are real, but its condition is fictional.**

Why the reports are synthetic, and the production-swap argument: no public corpus of real technical inspection reports exists at volume (they are commercial deliverables), and EUBUCCO has no names or addresses. A seeded generator is the only fully reproducible option, and generating the corpus from code is more robust than scraping while demonstrating that the target schema is understood. In production these PDFs are replaced by **real SECO reports without changing the rest of the pipeline**: extraction, scoring, RAG and the schema all stay the same. This is a deliberate, documented engineering decision, not a shortcut.

More detail lives in `docs/data-sources.md`.

### 4. Technical decisions and tradeoffs

**Architecture overview.** Two layers. A core Python library, `src/buildinglens/`, holds all the logic (data ingestion, LLM access, extraction, scoring, RAG, report generation). A thin **FastAPI** layer, `api/`, composes that core into HTTP endpoints; it never reimplements logic, it calls core functions, and the core never imports the API. Storage is a single **SQLite** database. Two front-ends sit on top of the same API: a **React + Vite + TypeScript** single-page app (`web/`, the polished presentation layer) and a lightweight **Streamlit** app (`app/`, the reference UI). The two front-ends are intentional, see the tradeoffs below.

**LLM provider abstraction.** A single `LLMClient` protocol (`complete` and `stream`) is implemented by six backends: `anthropic`, `openai`, `mistral`, `local` (Ollama over HTTP, no key), and `mock`. Every provider SDK is imported lazily, so a missing package only fails if you actually select that provider. The factory has a deliberate safety behaviour: if an online provider is selected but its key is missing, it returns the mock client instead of crashing, and callers can detect that silent fallback. This is what keeps the whole app runnable with no key.

**Runtime settings overlay.** Provider, key and model can be changed at runtime from the Settings page and are persisted in SQLite (`app_settings` table), so configuration survives a restart. The `Settings` dataclass is frozen and never mutated; instead the effective config is rebuilt from `.env` defaults plus persisted overrides and atomically rebound. The database path is deliberately excluded from what can be overridden at runtime. The tradeoff is honest: the live path uses single-process module-global rebinding rather than dependency injection, which is simple and correct for one server process but would need rethinking under multiple worker processes.

Other decisions and the tradeoffs accepted:

- **SQLite, not Postgres.** Zero setup, fully reproducible, fast enough for this scale, and it makes `make data && make run` work from zero. WAL journaling and a busy-timeout are enabled so the API can serve reads, settings writes and ingest writes from a threadpool without "database is locked" errors. Tradeoff: it would not survive a real concurrent multi-writer production load; that is a known swap.
- **pdfplumber for text, not OCR.** The synthetic corpus is born-digital, so plain text extraction is enough and OCR would be dead weight here. Tradeoff: real scanned reports with photos would need an OCR stage (Tesseract or a layout model), which is listed as a production redo.
- **Local embeddings for RAG.** Retrieval uses LlamaIndex with a local `sentence-transformers` multilingual model (`paraphrase-multilingual-MiniLM-L12-v2`), so no embedding text ever leaves the machine and there is no per-query network cost once the weights are cached. LlamaIndex's own LLM is forced off so it never builds an OpenAI client behind our back; generation always goes through our provider abstraction. Tradeoff: a small model and an in-memory vector store are fine for this corpus size but would move to a real vector store at scale.
- **Hand-tuned risk score, not a learned model.** The score is `100 * (1 - exp(-raw / K))` with severity weights critical=10, major=4, minor=1 and K=30, which saturates so even very defective buildings stay inside 0 to 100. It is calibrated for a plausible spread, not learned. Tradeoff stated openly: with a real labelled history this should become a fitted model.
- **One extraction call per document.** Extraction is a single grounded JSON call per report (no tool-use), with fence-tolerant parsing and a retry on the substring between the first and last brace. Defects with an unrecognised severity are skipped with a warning rather than inserted. This favours robustness and simplicity over squeezing maximum recall.
- **Streamlit first, then React.** Streamlit proved the three core features fast and stays as the minimal reference UI. The React app was added on top of the same API to make the product demo-grade (dossier views, streaming Q&A, a portfolio chart, a locator map). Keeping both is a deliberate "reference plus polished" split, not duplication of logic.
- **Defensive degradation everywhere.** Every external fetch (EUBUCCO, LUSTAT, commune boundaries) has a deterministic offline fallback, bad rows are warned-and-skipped instead of aborting a batch, and a failed ingest performs a full compensating rollback so it never leaves orphans.
- **Import guarded against duplicates.** A new building created from an address is snapped to its real EUBUCCO footprint; the same footprint under the same name is then recognised as one already on file, so the import is blocked (the existing dossier is shown, with a one-click override) instead of silently creating a copy. Looser matches (a similar name, a nearby footprint) are surfaced but never block, so a genuinely new building is never wrongly refused. The check runs under the ingest lock and before the expensive extraction, so it also closes the double-submit race and a refused duplicate costs nothing.

The signature feature, in honest status, is described in **Status and roadmap** below.

The web app is styled as a dark "dossier / terminal" interface. It bundles complete English and French translation resources, but it currently initialises in English only and has no active language switcher in the UI (the French bundle stays loaded so the toggle can be re-enabled later). Stated plainly so there is no overclaim.

More detail lives in `docs/architecture.md` and `docs/api.md`.

### 5. What I would put in production tomorrow vs throw away

**Keep for production (with small changes):**

- The core library boundary (data / LLM / extraction / scoring / RAG kept separate from the API). It is the part worth defending.
- The provider abstraction and the mock fallback. Being able to switch provider or run offline with no key is genuinely useful operationally.
- The extraction contract: structured defects with a verbatim citation per finding, which is what makes the output auditable.
- The RAG citation and "I don't know" guardrail, the batched (never N+1) source resolution, and the streaming protocol.
- The reproducible pipeline with offline fallbacks and the honest real-vs-synthetic provenance encoded in the schema.

**Throw away or redo before production:**

- The **synthetic inspection reports**, replaced by real SECO reports (the rest of the pipeline stays).
- The **synthetic evaluation gold set**, replaced by a hand-labelled one on real reports (see the evaluation section for why the current 1.00 is not a real accuracy figure).
- The **hand-tuned scoring weights**, replaced by a model fitted on real claim or defect history.
- **SQLite**, swapped for a managed database once there is real concurrency, and the runtime overlay's single-process rebinding reworked for multiple workers.
- **CORS** allows any localhost origin in dev (a regex, so the Vite fallback port still works); production needs a tightened origin list or a reverse proxy.
- An **OCR stage** would be added for scanned reports.

### 6. With 3 more months

This section is a vision only and is intentionally not coded. BuildingLens would grow from a per-building tool into a **portfolio-scale insurer risk cockpit**:

- A **geo-map** of the stock (using the real coordinates and communes already in the data) with risk hotspots and multi-building aggregation, cross-referenced with energy class.
- A **machine-readable risk signal delivered to insurers via API**, turning the control service into a data product (this is the natural extension of SECO's existing insurer touchpoint).
- **Computer vision on defect photos** and spatial tracking of observations on a BIM model (the GEOLUX / 3D-scan angle), so a defect is located in space, not just in text.
- Operational hardening: **Azure Entra ID SSO** (the web app already shows a documentation-only placeholder for it), **incremental RAG indexing** with a background ingest queue instead of a full reindex per upload, and the production data and model swaps listed above.

### Architecture at a glance

```
Public sources                Core (src/buildinglens/)              Interfaces
--------------                ------------------------              ----------
EUBUCCO parquet  ─┐
ACT communes     ─┼─ ingest ─▶ SQLite (buildings/documents/        FastAPI (api/)  ─┬─▶ React + Vite (web/)
STATEC permits   ─┘            defects/app_settings)                                 └─▶ (same API)
                                      │                             Streamlit (app/)
Synthetic PDFs  ── ingest_pdf ────────┤
                                      ├─ extract  (LLM, JSON + citation)
                                      ├─ scoring  (0..100 risk)
                                      └─ rag      (LlamaIndex + local embeddings,
                                                   generation via provider abstraction)

LLM provider abstraction: anthropic | openai | mistral | local (Ollama) | mock
Runtime settings (provider/key/model) persisted in SQLite, changeable without restart.
```

### Reproducibility

Everything runs from zero. Python 3.11 recommended.

```bash
# 1. Core (Python) backend
make install      # pip install -r requirements.txt + pip install -e .
make data         # download EUBUCCO + STATEC, load committed commune boundaries,
                  # generate synthetic inspection PDFs (fixed seed), populate SQLite
make extract      # LLM defect extraction + risk scoring + build RAG index
make eval         # evaluate extraction against the gold set (run make extract first)
make run          # launch the Streamlit app (python -m streamlit run app/streamlit_app.py)

# Extras
make test         # pytest
make fmt          # ruff format
make clean        # remove the generated DB (keeps downloaded raw sources)
```

```bash
# 2. FastAPI backend (for the React app)
python -m uvicorn api.main:app --port 8000

# 3. React web app (in another terminal)
cd web
npm install
npm run dev        # Vite dev server on http://localhost:5173, proxies /api to :8000
```

**Mock mode (no API key).** Copy `.env.example` to `.env`. With no key, set `LLM_PROVIDER=mock` (or pass `--mock`) to use deterministic fixtures: the whole pipeline, the app and the evaluation all run offline. `.env` is never committed; keys are left blank in the example (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MISTRAL_API_KEY`), the default model is `claude-opus-4-8`, and the local provider points at Ollama (`http://localhost:11434`, `llama3.1`). Note: real defect extraction needs a key. In mock mode `make extract` inserts no defects, so `make eval` then reports the gold set with zero predicted and prints a hint to configure a key.

### Evaluation

Evaluation lives in `eval/eval_extraction.py` and compares the **predicted** defects (what extraction wrote into the `defects` table) against a **synthetic ground truth**.

- **Gold set.** It is the exact set of defects the generator embedded in each report, rebuilt at eval time and persisted to `eval/gold.jsonl` (one JSON line per defect). The committed set is **241 defects across 40 buildings**.
- **Matching.** Element-level, per building: a prediction matches a gold defect when their normalised element token sets overlap enough (Jaccard at least 0.5, or one set is a subset of the other). Matching is greedy and one-to-one.
- **Metrics reported.** `gold_defects`, `predicted_defects`, `matched` (true positives), **precision**, **recall**, **F1**, and **severity accuracy** measured only on matched pairs (exact severity match), all rounded to three decimals.

**Honest limitations.** Because the same generator both writes the PDFs and emits the gold set, this is a **mechanics check on extraction fidelity over synthetic text, not real-world accuracy.** With Claude the run reports precision, recall and F1 of 1.00 and severity accuracy 1.00; that is expected and only shows the model re-reading what the generator injected and mapping each RICS rating to the right severity. It should not be read as a real accuracy figure. Real, heterogeneous reports with OCR noise and varied wording would score lower and would need a hand-labelled gold set, which is listed as a redo-before-production item.

Other limitations stated plainly:

- **Hallucinations.** The RAG path is constrained to answer only from retrieved text, cite its sources, and say it does not know otherwise, but no LLM guardrail is perfect.
- **False positives.** Extraction can over-extract or mis-classify on real prose; the citation field exists precisely so a human can check each finding.
- **Synthetic inspection data.** The reports and the defects in them are generated, so the condition of every building is fictional; only its location and footprint are real.

### Demo

A short screencast of the product is recorded locally (run the FastAPI backend and the React app, then walk through search, a building dossier and ingest). A step-by-step demo plan is in `docs/demo-script.md`. The demo is a **bonus**, not a core deliverable.

### Status and roadmap

Core MVP is complete.

- [x] `make data && make run` works from zero (reproducible)
- [x] At least two heterogeneous sources ingested, at least one real public source cited
- [x] AI defect extraction and severity classification, evaluated (synthetic mechanics check, P/R/F1 = 1.00; see Evaluation for why this is not a real-world accuracy figure)
- [x] RAG with citations and an anti-hallucination "I don't know" guardrail
- [x] Usable UI (Streamlit reference UI plus a React companion app)
- [x] `--mock` mode to run with no API key
- [x] README answering the six questions, with documented limits and owned tradeoffs
- [x] Clean, atomic git history
- [~] **Signature feature, partial.** Per-building client reports (Excel and PDF, with severity colour coding and an LLM executive summary that falls back to a deterministic template in mock mode) are implemented and exportable from the building dossier. The fuller insurer-style synthesis table with automatic flagging of deviations against public taxonomies (RICS / ASTM) is **not** finished and is honestly carried as roadmap, per the time-box rule (core features first).
- [ ] Demo screencast (bonus, recorded locally)

---

## Français

### Pitch en un paragraphe

Un assureur ou un asset manager assis sur une pile de rapports d'inspection ne peut pas répondre vite à une question simple : quels bâtiments de mon portefeuille présentent des défauts critiques, et lesquels ? Les rapports sont riches mais non structurés, donc le risque reste enfermé dans les PDF. BuildingLens lit ces rapports, en extrait chaque défaut avec sa sévérité et une citation textuelle, agrège chaque bâtiment en un score de risque unique, et expose un Q&A en langage naturel qui répond uniquement à partir du texte source et indique quand il ne sait pas. Le tout tourne sur des données publiques, sur un corpus de démonstration de 40 bâtiments inspectés, se reproduit depuis zéro, et fonctionne hors ligne en mode mock sans clé API.

### 1. Quel problème, et pour qui ?

L'utilisateur est un **asset manager ou un assureur construction**. Le point de douleur concret : aujourd'hui il ne peut pas obtenir une réponse rapide à l'échelle du portefeuille à la question "lesquels de mes bâtiments ont des défauts critiques, et lesquels ?", parce que la réponse est dispersée dans des rapports d'inspection rédigés en prose, pas dans une structure interrogeable.

BuildingLens répond avec trois briques qui fonctionnent ensemble :

1. **Extraction des défauts.** Un PDF d'inspection devient une liste structurée de défauts, chacun avec `element`, `description`, `location`, `severity` (critique / majeur / mineur) et une `citation` (l'extrait textuel du rapport qui le justifie).
2. **Scoring du risque.** Les défauts d'un bâtiment sont agrégés en un score de risque unique de 0 à 100, plus le décompte critique / majeur / mineur, pour classer tout un parc d'un coup d'oeil.
3. **Q&A RAG avec citations.** On peut demander, en français ou en anglais, "quels sont les défauts critiques du bâtiment X ?" ou "quels bâtiments présentent un risque incendie ?". Les réponses sont ancrées uniquement dans le texte récupéré, chaque réponse cite les blocs sources utilisés, et le modèle est instruit de dire qu'il ne sait pas plutôt que d'inventer.

Le cadrage part volontairement du problème (un risque invisible dans des documents non structurés) pour remonter vers la technique, et non l'inverse.

### 2. En quoi est-ce pertinent pour SECO ?

SECO est un organisme indépendant de contrôle technique et d'ingénierie pour la construction (fondé en 1934 en Belgique, SECO Luxembourg depuis 1987, environ 12 500 ouvrages inspectés au fil de son histoire). Son métier coeur, le contrôle technique de construction, est exactement l'amont de la garantie d'assurance décennale et biennale : SECO produit le rapport initial pour l'assureur ainsi que les notes d'inspection qui forment la base de l'évaluation du risque.

Ce métier génère de gros volumes de données techniques (rapports d'inspection par phase, tableaux de synthèse des observations par discipline, photos de défauts, mesures, scans BIM) qui restent aujourd'hui largement sous-exploités. Il n'y a ni recherche ni RAG sur les rapports, ni modèle de défauts par-dessus. C'est précisément le point de douleur de ce challenge.

BuildingLens s'adresse directement à la chaîne de valeur de SECO :

- La structure défaut-par-discipline qu'il produit reflète les propres tableaux de synthèse des observations de SECO, où chaque constat est tagué par discipline et noté.
- Le point de contact assureur est l'endroit naturel pour un **signal de risque exploitable par machine** au lieu d'un PDF, ce qui transforme un service de contrôle en partenariat de données.
- Le corpus historique de SECO (des milliers d'ouvrages inspectés) est un jeu de données propriétaire uniquement structurable : des observations horodatées, taguées par discipline, liées aux plans et aux normes. C'est l'un des problèmes "non structuré vers structuré" les plus propres de la construction.

La taxonomie de sévérité est ancrée sur des échelles publiques reconnues (les notes de condition RICS C1/C2/C3 comme trois classes canoniques, avec ASTM E2018 et les classes de conséquence Eurocode CC1/CC2/CC3 comme vocabulaire public complémentaire).

### 3. Quelles sources de données, et pourquoi ?

BuildingLens tourne sur des **données publiques et reproductibles uniquement**, en combinant trois sources luxembourgeoises réelles avec une couche synthétique. Tout peut être re-téléchargé ou régénéré depuis zéro par le pipeline.

| Source | Type / format | Rôle | Licence |
|---|---|---|---|
| **EUBUCCO v0.2 (Luxembourg, `nuts_id=LU00`)** | Structuré, par bâtiment, Parquet (géométrie en WKB, EPSG:3035), téléchargement S3 anonyme | Ancrage par bâtiment : emprises réelles, coordonnées, surface d'emprise, hauteur, plus usage et étages estimés par modèle. Peuple la table `buildings` | Mixte par bâtiment, stocké dans `buildings.source` : cadastre national LOD1 (gov-luxembourg, environ 77%) en CC0 ; OpenStreetMap (environ 13%) en ODbL (attribution et partage à l'identique) ; Microsoft (environ 10%) |
| **STATEC "Autorisations de bâtir"** | Structuré, agrégé, CSV labellisé via l'API REST SDMX LUSTAT (sans clé) | Contexte sectoriel uniquement : tendances d'autorisations par canton et type. Jamais joint aux bâtiments individuels. Satisfait la deuxième source hétérogène du brief | CC0 |
| **Limites communales ACT (Luxembourg)** | Polygones structurés, GeoJSON, EPSG:4326, versionné dans le dépôt (environ 1 Mo) | Récupère la commune réelle de chaque bâtiment par point-dans-polygone sur son centroïde (EUBUCCO ne porte qu'un code grossier, pas un nom) | CC0 |
| **Rapports d'inspection synthétiques** | PDF non structuré (généré avec ReportLab) | Le corpus d'inspection qui alimente l'extraction et le RAG | Généré par le projet |

Pourquoi ces sources : EUBUCCO est la meilleure source ouverte d'attributs par bâtiment pour le Luxembourg (environ 186 000 bâtiments dans le sous-ensemble LU), avec géométrie et hauteur réelles à l'échelle du pays, sans compte. STATEC donne un contexte sectoriel officiel, exploitable par machine et épinglable (dataflows plus `startPeriod`), sans prétendre à une précision par bâtiment. Les limites ACT récupèrent un attribut administratif réel (la commune) qu'EUBUCCO ne nomme pas, et elles sont versionnées dans le dépôt pour que le build reste hors ligne et reproductible à l'octet près.

**Réel vs synthétique (dit honnêtement, et encodé dans les commentaires du schéma) :**

- **Réel, par bâtiment :** géométrie d'emprise et coordonnées (couverture 100%), surface d'emprise en m² calculée depuis le contour réel, et la commune résolue par point-dans-polygone. La hauteur est réelle (cadastre / LOD1) pour environ 78% des bâtiments et estimée par ML pour environ 22%, la source étant signalée.
- **Réel mais estimé par modèle (libellé "estimé" dans l'UI) :** type et sous-type d'usage (en partie estimés par ML, en partie OpenStreetMap), étages (régression, stockés arrondis). L'année de construction est quasi absente dans le sous-ensemble LU et traitée comme non fiable.
- **Synthétique :** nom du bâtiment, rue, numéro et code postal (EUBUCCO n'en fournit aucun pour le Luxembourg), et les rapports d'inspection eux-mêmes avec chaque défaut qu'ils contiennent. Donc la **localisation et l'emprise d'un bâtiment sont réelles, mais son état est fictif.**

Pourquoi les rapports sont synthétiques, et l'argument du remplacement en production : aucun corpus public de vrais rapports d'inspection technique n'existe en volume (ce sont des livrables commerciaux), et EUBUCCO n'a ni noms ni adresses. Un générateur à graine est la seule option entièrement reproductible, et générer le corpus par code est plus robuste qu'un scraping tout en démontrant la maîtrise du schéma cible. En production, ces PDF sont remplacés par de **vrais rapports SECO sans rien changer au reste du pipeline** : extraction, scoring, RAG et schéma restent identiques. C'est une décision d'ingénierie délibérée et documentée, pas un raccourci.

Plus de détails dans `docs/data-sources.md`.

### 4. Décisions techniques et compromis

**Vue d'ensemble de l'architecture.** Deux couches. Une bibliothèque Python coeur, `src/buildinglens/`, porte toute la logique (ingestion des données, accès LLM, extraction, scoring, RAG, génération de rapports). Une fine couche **FastAPI**, `api/`, compose ce coeur en endpoints HTTP ; elle ne réimplémente jamais la logique, elle appelle les fonctions du coeur, et le coeur n'importe jamais l'API. Le stockage est une unique base **SQLite**. Deux front-ends s'appuient sur la même API : une application monopage **React + Vite + TypeScript** (`web/`, la couche de présentation soignée) et une application **Streamlit** légère (`app/`, l'UI de référence). Les deux front-ends sont intentionnels, voir les compromis ci-dessous.

**Abstraction de fournisseur LLM.** Un unique protocole `LLMClient` (`complete` et `stream`) est implémenté par six backends : `anthropic`, `openai`, `mistral`, `local` (Ollama en HTTP, sans clé) et `mock`. Chaque SDK fournisseur est importé paresseusement, donc un paquet manquant ne casse que si on sélectionne réellement ce fournisseur. La fabrique a un comportement de sécurité délibéré : si un fournisseur en ligne est sélectionné mais que sa clé manque, elle renvoie le client mock au lieu de planter, et les appelants peuvent détecter ce repli silencieux. C'est ce qui garde toute l'application exécutable sans clé.

**Couche de réglages à l'exécution.** Le fournisseur, la clé et le modèle sont modifiables à l'exécution depuis la page Réglages et persistés dans SQLite (table `app_settings`), donc la configuration survit à un redémarrage. La dataclass `Settings` est figée et jamais mutée ; à la place la config effective est reconstruite depuis les défauts `.env` plus les surcharges persistées, puis re-liée atomiquement. Le chemin de la base est volontairement exclu de ce qui est surchargeable à l'exécution. Le compromis est assumé : le chemin live utilise une re-liaison de variable globale de module mono-processus plutôt qu'une injection de dépendance, ce qui est simple et correct pour un seul processus serveur mais devrait être revu avec plusieurs processus workers.

Autres décisions et compromis acceptés :

- **SQLite, pas Postgres.** Zéro configuration, entièrement reproductible, assez rapide à cette échelle, et cela fait fonctionner `make data && make run` depuis zéro. Le journal WAL et un busy-timeout sont activés pour que l'API serve lectures, écritures de réglages et écritures d'ingestion depuis un pool de threads sans erreur "database is locked". Compromis : cela ne tiendrait pas une vraie charge production multi-écrivains concurrente ; c'est un remplacement connu.
- **pdfplumber pour le texte, pas d'OCR.** Le corpus synthétique est nativement numérique, donc l'extraction de texte simple suffit et l'OCR serait du poids mort ici. Compromis : de vrais rapports scannés avec photos demanderaient une étape OCR (Tesseract ou un modèle de mise en page), listée comme à refaire pour la production.
- **Embeddings locaux pour le RAG.** La récupération utilise LlamaIndex avec un modèle `sentence-transformers` multilingue local (`paraphrase-multilingual-MiniLM-L12-v2`), donc aucun texte d'embedding ne quitte la machine et il n'y a pas de coût réseau par requête une fois les poids en cache. Le LLM interne de LlamaIndex est désactivé pour qu'il ne construise jamais un client OpenAI dans notre dos ; la génération passe toujours par notre abstraction de fournisseur. Compromis : un petit modèle et un magasin de vecteurs en mémoire conviennent à ce corpus mais passeraient à un vrai magasin de vecteurs à l'échelle.
- **Score de risque calibré à la main, pas appris.** Le score vaut `100 * (1 - exp(-raw / K))` avec des poids de sévérité critique=10, majeur=4, mineur=1 et K=30, qui sature pour que même les bâtiments très dégradés restent dans 0 à 100. Il est calibré pour un étalement plausible, pas appris. Compromis énoncé ouvertement : avec un vrai historique labellisé, cela devrait devenir un modèle ajusté.
- **Un seul appel d'extraction par document.** L'extraction est un unique appel JSON ancré par rapport (sans tool-use), avec un parsing tolérant aux fences et un nouvel essai sur la sous-chaîne entre la première et la dernière accolade. Les défauts à sévérité non reconnue sont ignorés avec un avertissement plutôt qu'insérés. Cela privilégie la robustesse et la simplicité plutôt que le rappel maximal.
- **Streamlit d'abord, puis React.** Streamlit a prouvé les trois features coeur rapidement et reste l'UI de référence minimale. L'application React a été ajoutée par-dessus la même API pour rendre le produit présentable en démo (vues dossier, Q&A en streaming, graphique de portefeuille, carte de localisation). Garder les deux est un partage délibéré "référence plus soigné", pas une duplication de logique.
- **Dégradation défensive partout.** Chaque récupération externe (EUBUCCO, LUSTAT, limites communales) a un repli déterministe hors ligne, les lignes invalides sont averties-et-ignorées au lieu d'avorter un lot, et une ingestion échouée effectue un rollback compensatoire complet pour ne jamais laisser d'orphelins.
- **Import protégé contre les doublons.** Un nouveau bâtiment créé depuis une adresse est rattaché à son emprise réelle EUBUCCO ; la même emprise sous le même nom est alors reconnue comme déjà présente, donc l'import est bloqué (le dossier existant est montré, avec un contournement en un clic) au lieu de créer silencieusement une copie. Les correspondances plus souples (nom similaire, emprise proche) sont signalées mais ne bloquent jamais, donc un bâtiment réellement nouveau n'est jamais refusé à tort. Le contrôle s'exécute sous le verrou d'ingestion et avant l'extraction coûteuse, ce qui ferme aussi la course au double envoi et rend un doublon refusé gratuit.

La feature signature, en statut honnête, est décrite dans **Statut et feuille de route** plus bas.

L'application web est stylée comme une interface sombre "dossier / terminal". Elle embarque des ressources de traduction complètes en anglais et en français, mais elle s'initialise actuellement en anglais uniquement et n'a pas de sélecteur de langue actif dans l'UI (le bundle français reste chargé pour pouvoir réactiver le commutateur plus tard). Dit clairement, sans surpromesse.

Plus de détails dans `docs/architecture.md` et `docs/api.md`.

### 5. Que mettre en production demain vs jeter

**À garder pour la production (avec de petits changements) :**

- La frontière de la bibliothèque coeur (données / LLM / extraction / scoring / RAG séparés de l'API). C'est la partie qui mérite d'être défendue.
- L'abstraction de fournisseur et le repli mock. Pouvoir changer de fournisseur ou tourner hors ligne sans clé est réellement utile en exploitation.
- Le contrat d'extraction : des défauts structurés avec une citation textuelle par constat, ce qui rend la sortie auditable.
- Le garde-fou de citation et de "je ne sais pas" du RAG, la résolution des sources par requête groupée (jamais N+1), et le protocole de streaming.
- Le pipeline reproductible avec replis hors ligne et la provenance réel-vs-synthétique honnête encodée dans le schéma.

**À jeter ou refaire avant la production :**

- Les **rapports d'inspection synthétiques**, remplacés par de vrais rapports SECO (le reste du pipeline reste).
- Le **gold set d'évaluation synthétique**, remplacé par un gold set annoté à la main sur de vrais rapports (voir la section évaluation pour pourquoi le 1.00 actuel n'est pas un vrai chiffre de précision).
- Les **poids de scoring calibrés à la main**, remplacés par un modèle ajusté sur un historique réel de sinistres ou de défauts.
- **SQLite**, échangé contre une base managée dès qu'il y a de la vraie concurrence, et la re-liaison mono-processus de la couche de réglages retravaillée pour plusieurs workers.
- Le **CORS** accepte n'importe quelle origine localhost en dev (un regex, pour que le port de repli de Vite fonctionne aussi) ; la production demande une liste d'origines resserrée ou un reverse proxy.
- Une **étape OCR** serait ajoutée pour les rapports scannés.

### 6. Avec 3 mois de plus

Cette section est une vision uniquement, et n'est volontairement pas codée. BuildingLens passerait d'un outil par bâtiment à un **cockpit de risque assureur à l'échelle du portefeuille** :

- Une **carte géo** du parc (avec les coordonnées et communes réelles déjà présentes dans les données), points chauds de risque et agrégation multi-bâtiments, croisée avec la classe énergétique.
- Un **signal de risque exploitable par machine livré aux assureurs via API**, transformant le service de contrôle en produit de données (extension naturelle du point de contact assureur déjà existant chez SECO).
- De la **vision par ordinateur sur les photos de défauts** et un suivi spatial des observations sur un modèle BIM (l'angle GEOLUX / scan 3D), pour qu'un défaut soit localisé dans l'espace, pas seulement dans le texte.
- Durcissement opérationnel : **SSO Azure Entra ID** (l'application web montre déjà un placeholder documentaire), **indexation RAG incrémentale** avec une file d'ingestion en arrière-plan au lieu d'un réindex complet par upload, et les remplacements de données et de modèle listés plus haut.

### Architecture en bref

```
Sources publiques            Coeur (src/buildinglens/)             Interfaces
-----------------            -------------------------             ----------
EUBUCCO parquet  ─┐
Communes ACT     ─┼─ ingest ─▶ SQLite (buildings/documents/        FastAPI (api/)  ─┬─▶ React + Vite (web/)
Permis STATEC    ─┘            defects/app_settings)                                 └─▶ (même API)
                                      │                             Streamlit (app/)
PDF synthétiques ─ ingest_pdf ────────┤
                                      ├─ extract  (LLM, JSON + citation)
                                      ├─ scoring  (risque 0..100)
                                      └─ rag      (LlamaIndex + embeddings locaux,
                                                   génération via abstraction de fournisseur)

Abstraction de fournisseur LLM : anthropic | openai | mistral | local (Ollama) | mock
Réglages à l'exécution (fournisseur/clé/modèle) persistés dans SQLite, modifiables sans redémarrage.
```

### Reproductibilité

Tout tourne depuis zéro. Python 3.11 recommandé.

```bash
# 1. Backend coeur (Python)
make install      # pip install -r requirements.txt + pip install -e .
make data         # télécharge EUBUCCO + STATEC, charge les limites communales versionnées,
                  # génère les PDF d'inspection synthétiques (graine fixe), peuple SQLite
make extract      # extraction LLM des défauts + scoring du risque + construction de l'index RAG
make eval         # évalue l'extraction contre le gold set (lancer make extract d'abord)
make run          # lance l'application Streamlit (python -m streamlit run app/streamlit_app.py)

# Extras
make test         # pytest
make fmt          # ruff format
make clean        # supprime la base générée (garde les sources brutes téléchargées)
```

```bash
# 2. Backend FastAPI (pour l'application React)
python -m uvicorn api.main:app --port 8000

# 3. Application web React (dans un autre terminal)
cd web
npm install
npm run dev        # serveur de dev Vite sur http://localhost:5173, proxy /api vers :8000
```

**Mode mock (sans clé API).** Copier `.env.example` vers `.env`. Sans clé, mettre `LLM_PROVIDER=mock` (ou passer `--mock`) pour utiliser des fixtures déterministes : tout le pipeline, l'application et l'évaluation tournent hors ligne. `.env` n'est jamais commité ; les clés sont laissées vides dans l'exemple (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MISTRAL_API_KEY`), le modèle par défaut est `claude-opus-4-8`, et le fournisseur local pointe sur Ollama (`http://localhost:11434`, `llama3.1`). Note : la vraie extraction de défauts demande une clé. En mode mock, `make extract` n'insère aucun défaut, donc `make eval` rapporte alors le gold set avec zéro prédiction et affiche un indice pour configurer une clé.

### Évaluation

L'évaluation est dans `eval/eval_extraction.py` et compare les défauts **prédits** (ce que l'extraction a écrit dans la table `defects`) à une **vérité terrain synthétique**.

- **Gold set.** C'est l'ensemble exact des défauts que le générateur a intégrés dans chaque rapport, reconstruit au moment de l'éval et persisté dans `eval/gold.jsonl` (une ligne JSON par défaut). Le set versionné compte **241 défauts sur 40 bâtiments**.
- **Appariement.** Au niveau de l'élément, par bâtiment : une prédiction correspond à un défaut du gold quand leurs ensembles de tokens d'élément normalisés se recouvrent assez (Jaccard au moins 0,5, ou un ensemble est inclus dans l'autre). L'appariement est glouton et un-à-un.
- **Métriques rapportées.** `gold_defects`, `predicted_defects`, `matched` (vrais positifs), **précision**, **rappel**, **F1**, et **exactitude de sévérité** mesurée uniquement sur les paires appariées (correspondance exacte de sévérité), le tout arrondi à trois décimales.

**Limites honnêtes.** Comme le même générateur écrit les PDF et émet le gold set, c'est une **vérification de mécanique sur la fidélité d'extraction sur texte synthétique, pas une exactitude réelle.** Avec Claude le run rapporte une précision, un rappel et un F1 de 1.00 et une exactitude de sévérité de 1.00 ; c'est attendu et montre seulement que le modèle relit ce que le générateur a injecté et mappe chaque note RICS à la bonne sévérité. Cela ne doit pas se lire comme un vrai chiffre de précision. De vrais rapports hétérogènes, avec du bruit OCR et des formulations variées, obtiendraient un score plus bas et exigeraient un gold set annoté à la main, listé comme à refaire avant la production.

Autres limites énoncées clairement :

- **Hallucinations.** Le chemin RAG est contraint de répondre uniquement à partir du texte récupéré, de citer ses sources et de dire qu'il ne sait pas sinon, mais aucun garde-fou LLM n'est parfait.
- **Faux positifs.** L'extraction peut sur-extraire ou mal classer sur de la vraie prose ; le champ citation existe précisément pour qu'un humain vérifie chaque constat.
- **Données d'inspection synthétiques.** Les rapports et les défauts qu'ils contiennent sont générés, donc l'état de chaque bâtiment est fictif ; seules sa localisation et son emprise sont réelles.

### Démo

Un court screencast du produit est enregistré en local (lancer le backend FastAPI et l'application React, puis dérouler la recherche, un dossier bâtiment et l'ingestion). Un plan de démo pas à pas est dans `docs/demo-script.md`. La démo est un **bonus**, pas un livrable coeur.

### Statut et feuille de route

Le MVP coeur est terminé.

- [x] `make data && make run` fonctionne depuis zéro (reproductible)
- [x] Au moins deux sources hétérogènes ingérées, au moins une source publique réelle citée
- [x] Extraction IA des défauts et classification de sévérité, évaluées (vérification de mécanique sur synthétique, P/R/F1 = 1.00 ; voir Évaluation pour pourquoi ce n'est pas une exactitude réelle)
- [x] RAG avec citations et garde-fou anti-hallucination "je ne sais pas"
- [x] UI utilisable (UI de référence Streamlit plus application compagnon React)
- [x] Mode `--mock` pour tourner sans clé API
- [x] README répondant aux six questions, avec limites documentées et compromis assumés
- [x] Historique git propre et atomique
- [~] **Feature signature, partielle.** Les rapports client par bâtiment (Excel et PDF, avec code couleur de sévérité et un résumé exécutif LLM qui retombe sur un gabarit déterministe en mode mock) sont implémentés et exportables depuis le dossier bâtiment. Le tableau de synthèse assureur plus complet, avec flag automatique des écarts par rapport aux taxonomies publiques (RICS / ASTM), n'est **pas** terminé et est honnêtement porté en feuille de route, conformément à la règle de time-box (features coeur d'abord).
- [ ] Screencast de démo (bonus, enregistré en local)
