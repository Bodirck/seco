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
}

export interface AskResponse {
  answer: string;
  sources: Source[];
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
