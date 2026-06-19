# API reference

Base URL (local): `http://localhost:8000`

All responses are JSON unless noted. Error responses follow FastAPI's default shape:
`{"detail": "<message>"}` with an appropriate HTTP status code.

---

## GET /api/meta

Returns the active LLM provider and row counts from the database. Useful for the UI to detect mock mode and show data readiness.

**Request:** no body, no query parameters.

**Example response:**

```json
{
  "provider": "claude-3-5-haiku-20241022",
  "buildings": 40,
  "documents": 40,
  "defects": 241
}
```

When no API key is configured the provider value will be `"mock"` and defects will be 0 (mock mode does not extract defects).

---

## GET /api/buildings

Returns all buildings with their risk score and per-severity defect counts, sorted by risk score descending.

**Request:** no body, no query parameters.

**Example response:**

```json
{
  "buildings": [
    {
      "id": 12,
      "name": "Rue de Hollerich 45",
      "address": "45 Rue de Hollerich, Luxembourg City",
      "risk_score": 82.5,
      "latitude": 49.5975,
      "longitude": 6.1189,
      "height_m": 14.2,
      "source": "EUBUCCO",
      "critical": 3,
      "major": 7,
      "minor": 4
    },
    {
      "id": 7,
      "name": "Avenue de la Gare 18",
      "address": "18 Avenue de la Gare, Luxembourg City",
      "risk_score": 61.0,
      "latitude": 49.5996,
      "longitude": 6.1358,
      "height_m": 22.0,
      "source": "EUBUCCO",
      "critical": 1,
      "major": 5,
      "minor": 8
    }
  ]
}
```

---

## GET /api/buildings/{id}

Returns the full detail for one building: all fields from the list endpoint plus year built, source identifier, risk score breakdown, KPI aggregates, and the full defect list.

**Path parameter:** `id` (integer) - the building ID.

**404** when the building does not exist.

**Example response:**

```json
{
  "id": 12,
  "name": "Rue de Hollerich 45",
  "address": "45 Rue de Hollerich, Luxembourg City",
  "risk_score": 82.5,
  "latitude": 49.5975,
  "longitude": 6.1189,
  "height_m": 14.2,
  "source": "EUBUCCO",
  "year_built": 1978,
  "source_id": "LU_123456",
  "critical": 3,
  "major": 7,
  "minor": 4,
  "breakdown": {
    "building_id": 12,
    "risk_score": 82.5,
    "critical": 3,
    "major": 7,
    "minor": 4,
    "total": 14
  },
  "kpis": {
    "by_discipline": [
      { "discipline": "Roofing", "count": 5 },
      { "discipline": "Structure", "count": 4 },
      { "discipline": "Fire Safety", "count": 3 },
      { "discipline": "Facade", "count": 2 }
    ],
    "by_severity": {
      "critical": 3,
      "major": 7,
      "minor": 4
    }
  },
  "defects": [
    {
      "discipline": "Structure",
      "element": "Load-bearing wall",
      "description": "Visible cracking along mortar joints, width exceeding 3 mm.",
      "location": "North facade, ground floor",
      "severity": "critical",
      "citation": "Report p.4: 'Extensive cracking observed on load-bearing wall, north elevation.'"
    },
    {
      "discipline": "Roofing",
      "element": "Flat roof membrane",
      "description": "Punctures and loss of adhesion over 20% of surface.",
      "location": "Main roof, west section",
      "severity": "major",
      "citation": "Report p.7: 'Membrane failure on west side.'"
    }
  ]
}
```

Defects are ordered by severity (critical first, then major, then minor) then by discipline.

---

## POST /api/ask

Answers a free-text question using RAG: retrieves relevant document chunks from the LlamaIndex vector index, sends them to the LLM, and returns the answer with cited source snippets.

**Request body (JSON):**

| Field | Type | Required | Description |
|---|---|---|---|
| `question` | string | yes | The question to answer. |
| `building_id` | integer or null | no | If provided, restricts retrieval to chunks from that building. |

**Example request:**

```json
{
  "question": "Which buildings have critical fire-safety defects?",
  "building_id": null
}
```

**Example response:**

```json
{
  "answer": "Buildings 12 (Rue de Hollerich 45) and 3 (Boulevard Royal 8) both have critical fire-safety defects. Building 12 has a non-compliant emergency exit on the second floor, and Building 3 shows an inoperative sprinkler system.",
  "sources": [
    {
      "document_id": 18,
      "building_id": 12,
      "snippet": "Emergency exit on second floor does not meet current regulations (C3 condition)."
    },
    {
      "document_id": 5,
      "building_id": 3,
      "snippet": "Sprinkler system found inoperative during inspection."
    }
  ]
}
```

In mock mode (no API key) the answer field contains a placeholder string and sources is an empty array.

---

## GET /api/buildings/{id}/report

Generates and streams a per-building report as a file download.

**Path parameter:** `id` (integer) - the building ID.

**Query parameter:** `format` - `"pdf"` (default) or `"xlsx"`.

**404** when the building does not exist.

**Response:** binary file stream with appropriate `Content-Type` and `Content-Disposition: attachment` headers.

| format | Content-Type |
|---|---|
| `pdf` | `application/pdf` |
| `xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |

---

## curl examples

List all buildings:

```bash
curl http://localhost:8000/api/buildings
```

Get detail for building 12:

```bash
curl http://localhost:8000/api/buildings/12
```

Ask a question:

```bash
curl -X POST http://localhost:8000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Summarise the roofing problems across the portfolio"}'
```

Ask a question scoped to one building:

```bash
curl -X POST http://localhost:8000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the structural defects?", "building_id": 12}'
```

Download the PDF report for building 12:

```bash
curl -OJ "http://localhost:8000/api/buildings/12/report?format=pdf"
```

Download the Excel report for building 12:

```bash
curl -OJ "http://localhost:8000/api/buildings/12/report?format=xlsx"
```
