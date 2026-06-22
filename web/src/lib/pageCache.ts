import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

/**
 * App-level page cache.
 *
 * React Router unmounts a page when you navigate away, so any useState held in
 * a page is lost on the next visit (a search transcript vanishes, a list is
 * refetched from scratch). These two hooks move that state into module scope,
 * which lives for the whole app session, so a page keeps its data and its
 * in-progress work when you leave and come back.
 *
 * - usePersistentState: a drop-in useState whose value survives navigation.
 *   With { session: true } it is also mirrored to sessionStorage, so it
 *   survives a full page reload (used for the search transcript).
 * - useCachedResource: fetch-once-then-reuse for read-only API data, keyed by a
 *   string. The first visit fetches; later visits render the cached value with
 *   no loading flash and no refetch. reload() forces a refresh.
 */

// ---------------------------------------------------------------------------
// usePersistentState
// ---------------------------------------------------------------------------

const stateCache = new Map<string, unknown>();

function readSession<T>(key: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
}

export function usePersistentState<T>(
  key: string,
  initial: T | (() => T),
  options: { session?: boolean } = {},
): [T, Dispatch<SetStateAction<T>>] {
  const session = options.session ?? false;

  const [state, setState] = useState<T>(() => {
    if (stateCache.has(key)) return stateCache.get(key) as T;
    if (session) {
      const stored = readSession<T>(key);
      if (stored !== undefined) {
        stateCache.set(key, stored);
        return stored;
      }
    }
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });

  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (value) => {
      setState((prev) => {
        const next =
          typeof value === "function" ? (value as (p: T) => T)(prev) : value;
        stateCache.set(key, next);
        if (session) {
          try {
            sessionStorage.setItem(key, JSON.stringify(next));
          } catch {
            // sessionStorage may be full or unavailable; the in-memory cache
            // still keeps the value for the rest of this app session.
          }
        }
        return next;
      });
    },
    [key, session],
  );

  return [state, set];
}

// ---------------------------------------------------------------------------
// useCachedResource
// ---------------------------------------------------------------------------

const resourceCache = new Map<string, unknown>();
const inFlight = new Map<string, Promise<unknown>>();

export interface CachedResource<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
}

export function useCachedResource<T>(
  key: string,
  fetcher: () => Promise<T>,
): CachedResource<T> {
  const cached = resourceCache.has(key) ? (resourceCache.get(key) as T) : null;
  const [data, setData] = useState<T | null>(cached);
  const [loading, setLoading] = useState<boolean>(!resourceCache.has(key));
  const [error, setError] = useState<unknown>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Served from cache: no fetch, no loading flash.
    if (refreshTick === 0 && resourceCache.has(key)) {
      setData(resourceCache.get(key) as T);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Dedupe concurrent mounts asking for the same key.
    let promise = refreshTick === 0 ? inFlight.get(key) : undefined;
    if (!promise) {
      promise = fetcher();
      inFlight.set(key, promise);
    }

    promise
      .then((value) => {
        resourceCache.set(key, value);
        inFlight.delete(key);
        if (!cancelled) {
          setData(value as T);
          setLoading(false);
        }
      })
      .catch((err) => {
        inFlight.delete(key);
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // fetcher is intentionally excluded: the key identifies the resource, and an
    // inline fetcher would otherwise change identity on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshTick]);

  const reload = useCallback(() => {
    resourceCache.delete(key);
    inFlight.delete(key);
    setRefreshTick((n) => n + 1);
  }, [key]);

  return { data, loading, error, reload };
}
