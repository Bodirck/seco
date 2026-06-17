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
