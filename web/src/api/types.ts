export type Severity = "critical" | "major" | "minor";

export interface BuildingSummary {
  id: number;
  name: string;
  address: string;
  risk_score: number;
  latitude: number | null;
  longitude: number | null;
  height_m: number | null;
  source: string;
  critical: number;
  major: number;
  minor: number;
}

export interface Breakdown {
  building_id: number;
  risk_score: number;
  critical: number;
  major: number;
  minor: number;
  total: number;
}

export interface Defect {
  discipline: string;
  element: string;
  description: string;
  location: string;
  severity: Severity;
  citation: string;
}

export interface BuildingDetail extends BuildingSummary {
  year_built: number | null;
  source_id: string | null;
  /** EUBUCCO-derived attributes. Footprint area is real; use/floors are ML-estimated. */
  use_type: string | null;
  use_subtype: string | null;
  floors: number | null;
  footprint_area_m2: number | null;
  type_confidence: number | null;
  breakdown: Breakdown;
  kpis: {
    by_discipline: { discipline: string; count: number }[];
    by_severity: { critical: number; major: number; minor: number };
  };
  defects: Defect[];
}

export interface Source {
  document_id: number;
  building_id: number;
  snippet: string;
  /** The full retrieved chunk, so a citation can expand beyond the 200-char snippet. */
  full_text?: string;
  /** Retrieval relevance score; null when the backend does not expose one. */
  score: number | null;
  building_name: string | null;
  commune: string | null;
}

export interface AskResponse {
  answer: string;
  sources: Source[];
}

/** One conversation turn sent back to the server to ground a follow-up question. */
export interface Turn {
  question: string;
  answer: string;
}

/** A turn as held in the Search transcript, with its own streaming state and sources. */
export type ChatTurnStatus = "loading" | "streaming" | "success" | "error";

export interface ChatTurn {
  id: string;
  question: string;
  status: ChatTurnStatus;
  answer: string;
  sources: Source[];
  /** Human-readable summary of the scope this turn ran under, if any. */
  scopeSummary?: string;
  errorMessage?: string;
}

/** One frame of the NDJSON answer stream from POST /api/ask/stream. */
export type AskStreamEvent =
  | { type: "sources"; sources: Source[] }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

/** One selectable facet value with how many buildings carry it. */
export interface FacetOption {
  value: string;
  count: number;
}

/** Facet values for the Search scope bar (GET /api/search/options). */
export interface SearchOptions {
  communes: FacetOption[];
  uses: FacetOption[];
  severities: FacetOption[];
}

/** Result of POST /api/search/resolve: the building ids matching the chosen facets. */
export interface ResolveScopeResponse {
  building_ids: number[];
  count: number;
}

export interface Meta {
  provider: string;
  buildings: number;
  documents: number;
  defects: number;
}

/**
 * Result of POST /api/ingest. A PDF is attached either to an existing building
 * (building_id supplied) or to a freshly created one (name supplied). `mock` is
 * true when the active client is the MockClient, in which case no defects are
 * extracted and `message` says so.
 */
export interface IngestResult {
  document_id: number;
  building_id: number;
  building_name: string;
  defects_extracted: number;
  new_risk_score: number;
  chunks_indexed: number;
  mock: boolean;
  message: string;
  /** Close matches found at import time (new-building path); empty when none. */
  possible_duplicates?: DuplicateCandidate[];
}

/** Why a candidate is considered a possible duplicate. Mirrors dedup.py reasons. */
export type MatchReason =
  | "same_footprint"
  | "same_name"
  | "same_address"
  | "same_volume"
  | "similar_name"
  | "nearby";

/** One existing building surfaced as a possible duplicate of an import. */
export interface DuplicateCandidate {
  id: number;
  name: string;
  address: string;
  commune: string | null;
  source: string;
  source_id: string | null;
  risk_score: number;
  /** Metres between the two footprints; null when either lacks coordinates. */
  distance_m: number | null;
  /** difflib name-similarity ratio, 0..1. */
  name_similarity: number;
  reasons: MatchReason[];
  /** "exact" candidates triggered the block; "similar" are informational. */
  strength: "exact" | "similar";
}

/**
 * Structured body of a 409 from POST /api/ingest when a new building looks like
 * one already in the portfolio. Carried on ApiError.detail so the UI can show the
 * existing buildings and offer an "import anyway" override.
 */
export interface DuplicateDetail {
  code: "duplicate_building";
  message: string;
  /** The form field to set true to override the block (always "force"). */
  force_param: string;
  matched_source_id: string | null;
  candidates: DuplicateCandidate[];
}

/**
 * One building from the public registry (EUBUCCO Luxembourg), as returned by
 * GET /api/registry/candidates. Footprint-derived fields (coordinates, height) are
 * real; name and address are synthetic, since EUBUCCO has no per-building identity.
 */
export interface RegistryCandidate {
  source_id: string;
  name: string;
  address: string;
  year_built: number | null;
  height_m: number | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
  /** Real commune from point-in-polygon (ACT boundaries); null if unresolved. */
  commune: string | null;
}

/** Paginated result of GET /api/registry/search. */
export interface RegistrySearchResponse {
  candidates: RegistryCandidate[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

/** One commune with its count of not-yet-imported registry buildings. */
export interface CommuneOption {
  name: string;
  count: number;
}

export interface CommuneListResponse {
  communes: CommuneOption[];
}

export type SettingsProvider =
  | "anthropic"
  | "openai"
  | "mistral"
  | "local"
  | "mock";

/**
 * Current AI provider configuration as reported by GET/PUT /api/settings.
 * The raw API key is never returned: only whether one is set (`has_key`) and
 * its last 4 characters (`key_tail`). `effective` is the client actually in
 * use, so it reveals a silent fallback to mock when a key is missing.
 */
export interface SettingsState {
  provider: SettingsProvider;
  effective: string;
  anthropic_model: string;
  openai_model: string;
  mistral_model: string;
  ollama_base_url: string;
  ollama_model: string;
  has_key: { anthropic: boolean; openai: boolean; mistral: boolean };
  key_tail: {
    anthropic: string | null;
    openai: string | null;
    mistral: string | null;
  };
}

/**
 * Body for PUT /api/settings. Every field is optional; only sent fields are
 * applied. An empty-string key means "leave unchanged"; a non-empty key sets it.
 */
export interface SettingsUpdate {
  provider?: SettingsProvider;
  anthropic_api_key?: string;
  openai_api_key?: string;
  mistral_api_key?: string;
  anthropic_model?: string;
  openai_model?: string;
  mistral_model?: string;
  ollama_base_url?: string;
  ollama_model?: string;
}

/** Result of a real liveness check from POST /api/settings/test. */
export interface SettingsTestResult {
  ok: boolean;
  provider: string;
  effective: string;
  message: string;
}
