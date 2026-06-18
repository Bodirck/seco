import type {
  AskResponse,
  BuildingDetail,
  BuildingSummary,
  IngestResult,
  Meta,
  SettingsState,
  SettingsTestResult,
  SettingsUpdate,
} from "./types";

/**
 * Build an Error from a failed response, preferring the FastAPI `detail` body
 * (which carries the precise, user-meaningful message) over the bare status line.
 */
async function toError(res: Response): Promise<Error> {
  try {
    const body = await res.json();
    if (body && typeof body.detail === "string" && body.detail.trim()) {
      return new Error(body.detail);
    }
  } catch {
    // No JSON body; fall back to the status line.
  }
  return new Error(`${res.status} ${res.statusText}`);
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

  ask: async (question: string, buildingId?: number): Promise<AskResponse> => {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, building_id: buildingId ?? null }),
    });
    if (!res.ok) {
      throw await toError(res);
    }
    return (await res.json()) as AskResponse;
  },

  reportUrl: (id: number, format: "pdf" | "xlsx") =>
    `/api/buildings/${id}/report?format=${format}`,

  ingest: async (args: {
    file: File;
    buildingId?: number;
    name?: string;
    address?: string;
  }): Promise<IngestResult> => {
    const form = new FormData();
    form.append("file", args.file);
    if (args.buildingId !== undefined) {
      form.append("building_id", String(args.buildingId));
    } else {
      if (args.name) form.append("name", args.name);
      if (args.address) form.append("address", args.address);
    }
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
