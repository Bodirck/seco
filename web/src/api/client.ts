import type {
  AskResponse,
  BuildingDetail,
  BuildingSummary,
  Meta,
  SettingsState,
  SettingsTestResult,
  SettingsUpdate,
} from "./types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
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
      throw new Error(`${res.status} ${res.statusText}`);
    }
    return (await res.json()) as AskResponse;
  },

  reportUrl: (id: number, format: "pdf" | "xlsx") =>
    `/api/buildings/${id}/report?format=${format}`,

  getSettings: () => getJson<SettingsState>("/api/settings"),

  saveSettings: async (body: SettingsUpdate): Promise<SettingsState> => {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
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
      throw new Error(`${res.status} ${res.statusText}`);
    }
    return (await res.json()) as SettingsTestResult;
  },
};
