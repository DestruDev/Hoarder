import { useEffect, useMemo, useState } from 'react';

import {
  MIN_REMOTE_QUERY_LENGTH,
  searchRemoteCatalog,
  type RemoteSearchResult,
} from '@/lib/catalog-sources/search';
import type { MediaBrowseFilter } from '@/lib/media-search';

const DEBOUNCE_MS = 350;
const CACHE_LIMIT = 30;

// Recent queries, so backspacing or retyping doesn't hit the APIs again.
const cache = new Map<string, RemoteSearchResult>();

function cacheKey(query: string, filter: MediaBrowseFilter): string {
  return `${[...filter].sort().join(',')}|${query.trim().toLowerCase()}`;
}

function remember(key: string, result: RemoteSearchResult) {
  cache.delete(key);
  cache.set(key, result);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }
}

export type RemoteSearchState = RemoteSearchResult & {
  // True from the first keystroke until results (or failure) arrive.
  loading: boolean;
};

// Debounced online search. Each new query aborts the request in flight, so stale
// results can never land over newer ones.
export function useRemoteSearch(query: string, filter: MediaBrowseFilter): RemoteSearchState {
  const trimmed = query.trim();
  const enabled = trimmed.length >= MIN_REMOTE_QUERY_LENGTH;
  const key = cacheKey(trimmed, filter);
  const [state, setState] = useState<{ key: string; result: RemoteSearchResult } | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const cached = cache.get(key);
    if (cached) {
      setState({ key, result: cached });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchRemoteCatalog(trimmed, filter, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) {
            return;
          }
          // Don't cache a partial failure; the next keystroke should retry.
          if (result.failed.length === 0) {
            remember(key, result);
          }
          setState({ key, result });
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) {
            console.warn('[Hoarder search] search failed:', reason);
            setState({ key, result: { items: [], failed: ['online search'] } });
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `key` already encodes the query and filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return useMemo(() => {
    if (!enabled) {
      return { items: [], failed: [], loading: false };
    }

    if (state?.key === key) {
      return { ...state.result, loading: false };
    }

    // While the next request is pending, keep the previous results that still match
    // what's typed, so the list narrows instead of blanking on every keystroke.
    const needle = trimmed.toLowerCase();
    const stale = (state?.result.items ?? []).filter((item) =>
      item.title.toLowerCase().includes(needle),
    );
    return { items: stale, failed: [], loading: true };
  }, [enabled, key, state, trimmed]);
}
