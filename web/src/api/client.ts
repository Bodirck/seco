import type {
  AskResponse,
  AskStreamEvent,
  BuildingDetail,
  BuildingSummary,
  CommuneListResponse,
  IngestResult,
  Meta,
  RegistryCandidate,
  RegistrySearchResponse,
  ResolveScopeResponse,
  SearchOptions,
  Source,
  Turn,
  SettingsState,
  SettingsTestResult,
  SettingsUpdate,
} from "./types";

/** Options for the ask calls. A plain number is accepted for the legacy
 *  positional building-id form the building-page AskBar uses. */
export interface AskOptions {
  buildingId?: number;
  buildingIds?: number[];
  history?: Turn[];
  /** Abort signal so a non-streaming ask (e.g. the streaming fallback) can be cancelled. */
  signal?: AbortSignal;
}

function askBody(question: string, o: AskOptions): Record<string, unknown> {
  const body: Record<string, unknown> = { question };
  if (o.buildingId !== undefined) body.building_id = o.buildingId;
  if (o.buildingIds && o.buildingIds.length) body.building_ids = o.buildingIds;
  if (o.history && o.history.length) body.history = o.history;
  return body;
}

/** Error carrying the HTTP status so callers can branch on it (e.g. 404). */
export class ApiError extends Error {
  readonly status: number;
  /**
   * The raw FastAPI `detail` when it is a structured object rather than a string
   * (e.g. the duplicate-building 409 payload). Callers that understand a specific
   * shape can read it; everyone else just uses `message`.
   */
  readonly detail?: unknown;
  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Build an ApiError from a failed response, preferring the FastAPI `detail` body
 * (which carries the precise, user-meaningful message) over the bare status line,
 * and keeping the HTTP status so callers can distinguish e.g. a 404 from a 500.
 * When `detail` is a structured object (some endpoints return one, like the
 * duplicate-building 409), we keep the object on the error and use its `message`
 * field as the human-readable string so plain alerts still render text.
 */
async function toError(res: Response): Promise<ApiError> {
  let message = `${res.status} ${res.statusText}`;
  let detail: unknown;
  try {
    const body = await res.json();
    if (body && typeof body.detail === "string" && body.detail.trim()) {
      message = body.detail;
    } else if (body && body.detail && typeof body.detail === "object") {
      detail = body.detail;
      const m = (body.detail as { message?: unknown }).message;
      if (typeof m === "string" && m.trim()) message = m;
    }
  } catch {
    // No JSON body; keep the status line.
  }
  return new ApiError(res.status, message, detail);
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw await toError(res);
  }
  return (await res.json()) as T;
}

export const api = {
  meta: () => getJson<Meta>("/api/meta"),

  buildings: () =>
    getJson<{ buildings: BuildingSummary[] }>("/api/buildings").then((r) => r.buildings),

  building: (id: number) => getJson<BuildingDetail>(`/api/buildings/${id}`),

  deleteBuilding: async (id: number): Promise<void> => {
    const res = await fetch(`/api/buildings/${id}`, { method: "DELETE" });
    if (!res.ok) throw await toError(res);
  },

  ask: async (
    question: string,
    opts?: number | AskOptions,
  ): Promise<AskResponse> => {
    const o: AskOptions = typeof opts === "number" ? { buildingId: opts } : opts ?? {};
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(askBody(question, o)),
      signal: o.signal,
    });
    if (!res.ok) {
      throw await toError(res);
    }
    return (await res.json()) as AskResponse;
  },

  /**
   * Stream an answer from POST /api/ask/stream. The body is read as
   * newline-delimited JSON: a frame can straddle two network chunks, so we
   * buffer and only parse on a newline boundary, flushing any trailing line at
   * the end. Resolves when the stream ends; throws an ApiError on an error frame
   * or a non-OK response (the caller can fall back to the non-streaming ask).
   */
  askStream: async (
    question: string,
    opts: AskOptions & {
      signal?: AbortSignal;
      onSources?: (sources: Source[]) => void;
      onDelta?: (text: string) => void;
    },
  ): Promise<void> => {
    const res = await fetch("/api/ask/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(askBody(question, opts)),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) {
      throw await toError(res);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const handle = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let ev: AskStreamEvent;
      try {
        ev = JSON.parse(trimmed) as AskStreamEvent;
      } catch {
        return; // skip a malformed line rather than abort the whole stream
      }
      if (ev.type === "sources") opts.onSources?.(ev.sources);
      else if (ev.type === "delta") opts.onDelta?.(ev.text);
      else if (ev.type === "error") throw new ApiError(500, ev.message);
    };

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        handle(line);
      }
    }
    if (buffer.trim()) handle(buffer);
  },

  searchOptions: () => getJson<SearchOptions>("/api/search/options"),

  resolveScope: async (scope: {
    communes: string[];
    uses: string[];
    severities: string[];
  }): Promise<ResolveScopeResponse> => {
    const res = await fetch("/api/search/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scope),
    });
    if (!res.ok) {
      throw await toError(res);
    }
    return (await res.json()) as ResolveScopeResponse;
  },

  reportUrl: (id: number, format: "pdf" | "xlsx") =>
    `/api/buildings/${id}/report?format=${format}`,

  registryCandidates: (n = 8) =>
    getJson<{ candidates: RegistryCandidate[] }>(
      `/api/registry/candidates?n=${n}`,
    ).then((r) => r.candidates),

  registrySearch: (q: string, page = 1, pageSize = 20) =>
    getJson<RegistrySearchResponse>(
      `/api/registry/search?q=${encodeURIComponent(q)}&page=${page}&page_size=${pageSize}`,
    ),

  communes: (q = "", limit = 50) =>
    getJson<CommuneListResponse>(
      `/api/registry/communes?q=${encodeURIComponent(q)}&limit=${limit}`,
    ).then((r) => r.communes),

  ingest: async (args: {
    file: File;
    buildingId?: number;
    name?: string;
    address?: string;
    registrySourceId?: string;
    /** Override the duplicate guardrail and import a new building anyway. */
    force?: boolean;
  }): Promise<IngestResult> => {
    const form = new FormData();
    form.append("file", args.file);
    if (args.buildingId !== undefined) {
      form.append("building_id", String(args.buildingId));
    } else if (args.registrySourceId) {
      form.append("registry_source_id", args.registrySourceId);
    } else {
      if (args.name) form.append("name", args.name);
      if (args.address) form.append("address", args.address);
    }
    if (args.force) form.append("force", "true");
    // No Content-Type header: the browser sets the multipart boundary itself.
    const res = await fetch("/api/ingest", { method: "POST", body: form });
    if (!res.ok) {
      throw await toError(res);
    }
    return (await res.json()) as IngestResult;
  },

  getSettings: () => getJson<SettingsState>("/api/settings"),

  saveSettings: async (body: SettingsUpdate): Promise<SettingsState> => {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw await toError(res);
    }
    return (await res.json()) as SettingsState;
  },

  testSettings: async (provider?: string): Promise<SettingsTestResult> => {
    const res = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(provider ? { provider } : {}),
    });
    if (!res.ok) {
      throw await toError(res);
    }
    return (await res.json()) as SettingsTestResult;
  },
};
