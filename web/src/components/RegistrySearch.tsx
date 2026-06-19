import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { RegistryCandidate, RegistrySearchResponse } from "../api/types";
import { Button, Input, Spinner } from "./ui";
import { cn } from "../lib/cn";

const MIN_QUERY = 2;
const PAGE_SIZE = 20;

interface Props {
  selectedId: string;
  onSelect: (candidate: RegistryCandidate) => void;
}

/**
 * Search the public registry by commune: a debounced commune query, paginated
 * results (20 per page), each a selectable card showing the building name, its real
 * commune and coordinates. Fetches are race-guarded so a slow earlier response never
 * overwrites a newer one, and the page resets to 1 whenever the query changes.
 */
export default function RegistrySearch({ selectedId, onSelect }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RegistrySearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  // Debounce the query (300ms) and reset to page 1 on every change.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  // Fetch when the debounced query (>= MIN_QUERY chars) or the page changes.
  useEffect(() => {
    if (debounced.length < MIN_QUERY) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    api
      .registrySearch(debounced, page, PAGE_SIZE)
      .then((res) => {
        if (id !== reqId.current) return; // a newer request superseded this one
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (id !== reqId.current) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, [debounced, page]);

  const tooShort = debounced.length < MIN_QUERY;
  const candidates = data?.candidates ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 1;
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = (page - 1) * PAGE_SIZE + candidates.length;

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        label={t("ingest.searchByCommune")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("ingest.searchPlaceholder")}
      />

      {tooShort ? (
        <p className="text-xs text-fg-faint">{t("ingest.searchPlaceholderHint")}</p>
      ) : error ? (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      ) : (
        <div
          role="region"
          aria-live="polite"
          aria-busy={loading}
          aria-label={t("ingest.searchByCommune")}
          className="flex flex-col gap-2"
        >
          {loading && candidates.length === 0 ? (
            <div className="flex items-center gap-2 py-2 text-sm text-fg-muted">
              <Spinner size="sm" />
              {t("ingest.registryLoading")}
            </div>
          ) : total === 0 ? (
            <p className="text-sm text-fg-muted">{t("ingest.noMatch")}</p>
          ) : (
            <>
              <ul className={cn("flex flex-col gap-1.5", loading && "opacity-60")}>
                {candidates.map((c) => {
                  const selected = c.source_id === selectedId;
                  return (
                    <li key={c.source_id}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onSelect(c)}
                        className={cn(
                          "w-full rounded-sm border px-3 py-2 text-left transition duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70",
                          selected
                            ? "border-signal-400/60 bg-ink-800"
                            : "border-line bg-ink-850 hover:border-line-strong",
                        )}
                      >
                        <span className="block font-display text-sm font-semibold uppercase tracking-wide text-fg">
                          {c.name}
                        </span>
                        <span className="mt-0.5 block font-mono text-xs text-fg-faint">
                          {c.commune ?? "?"}
                          {c.latitude != null && c.longitude != null
                            ? ` · ${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}`
                            : ""}
                          {c.height_m != null ? ` · ${c.height_m} m` : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="flex items-center justify-between gap-2 text-xs text-fg-faint">
                <span className="font-mono">
                  {t("ingest.showingRange", { from: rangeStart, to: rangeEnd, total })}
                </span>
                {totalPages > 1 && (
                  <span className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      {t("ingest.prev")}
                    </Button>
                    <span className="font-mono">
                      {t("ingest.pageOf", { page, pages: totalPages })}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page >= totalPages || loading}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      {t("ingest.next")}
                    </Button>
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
