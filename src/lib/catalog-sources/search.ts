import type { NewCatalogItem } from '@/lib/db/types';
import { comicFilterValue, matchesMediaTypeFilter, type MediaBrowseFilter } from '@/lib/media-search';

import { searchAnilist } from './anilist';
import { isAbortError } from './http';
import { dedupeCatalogItems } from './index';
import { searchItunesBooks } from './itunes';
import { hydrateSteamEntry, searchSteam } from './steam';
import { hydrateTmdbEntry, searchTmdb, tmdbApiKey } from './tmdb';
import { hydrateTvmazeEntry, searchTvmaze } from './tvmaze';

// Results per media type per source. Enough to find what you typed, light enough to
// render instantly.
const PER_TYPE = 12;

export const MIN_REMOTE_QUERY_LENGTH = 2;

export type RemoteSearchResult = {
  items: NewCatalogItem[];
  // Sources that errored (not aborted), so the UI can say results may be incomplete.
  failed: string[];
};

type SearchSource = {
  name: string;
  run: (query: string, signal: AbortSignal) => Promise<NewCatalogItem[]>;
};

function wantedSources(filter: MediaBrowseFilter): SearchSource[] {
  const wants = (value: MediaBrowseFilter[number]) => filter.includes(value);
  const asianComics = wants(comicFilterValue('japanese')) ||
    wants(comicFilterValue('south_korean')) ||
    wants(comicFilterValue('chinese'));
  const sources: SearchSource[] = [];

  if (wants('anime') || asianComics) {
    sources.push({
      name: 'AniList',
      run: (query, signal) =>
        searchAnilist(query, { anime: wants('anime'), comic: asianComics }, PER_TYPE, signal),
    });
  }

  if ((wants('movie') || wants('tv')) && tmdbApiKey()) {
    sources.push({
      name: 'TMDB',
      run: (query, signal) =>
        searchTmdb(query, { movie: wants('movie'), tv: wants('tv') }, PER_TYPE, signal),
    });
  } else if (wants('tv')) {
    // No TMDB key: TV still works through TVMaze; movies need the key.
    sources.push({ name: 'TVMaze', run: (query, signal) => searchTvmaze(query, PER_TYPE, signal) });
  }

  if (wants('book') || wants(comicFilterValue('american'))) {
    sources.push({
      name: 'iTunes',
      run: (query, signal) =>
        searchItunesBooks(
          query,
          { book: wants('book'), comic: wants(comicFilterValue('american')) },
          PER_TYPE,
          signal,
        ),
    });
  }

  if (wants('game')) {
    sources.push({ name: 'Steam', run: (query, signal) => searchSteam(query, PER_TYPE, signal) });
  }

  return sources;
}

// Exact title first, then titles starting with the query, then the source's own order.
function matchRank(title: string, query: string): number {
  const normalizedTitle = title.trim().toLowerCase();
  if (normalizedTitle === query) {
    return 0;
  }
  return normalizedTitle.startsWith(query) ? 1 : 2;
}

export async function searchRemoteCatalog(
  query: string,
  filter: MediaBrowseFilter,
  signal: AbortSignal,
): Promise<RemoteSearchResult> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_REMOTE_QUERY_LENGTH) {
    return { items: [], failed: [] };
  }

  const sources = wantedSources(filter);
  const settled = await Promise.allSettled(sources.map((source) => source.run(trimmed, signal)));

  const items: NewCatalogItem[] = [];
  const failed: string[] = [];

  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      items.push(...result.value);
    } else if (!isAbortError(result.reason)) {
      failed.push(sources[index].name);
      console.warn(`[Hoarder search] ${sources[index].name} search failed:`, result.reason);
    }
  });

  const normalizedQuery = trimmed.toLowerCase();
  const ranked = dedupeCatalogItems(items)
    .filter((item) => matchesMediaTypeFilter(item, filter))
    .map((item, order) => ({ item, order, rank: matchRank(item.title, normalizedQuery) }))
    .sort((left, right) => left.rank - right.rank || left.order - right.order)
    .map(({ item }) => item);

  return { items: ranked, failed };
}

// Search results from TMDB, TVMaze and Steam carry only the basics; fetch the rest before the
// row is saved so the detail page has genres, episode counts and so on.
export async function hydrateSearchEntry(entry: NewCatalogItem): Promise<NewCatalogItem> {
  try {
    if (entry.source === 'tmdb-movie' || entry.source === 'tmdb-tv') {
      return await hydrateTmdbEntry(entry);
    }
    if (entry.source === 'steam') {
      return await hydrateSteamEntry(entry);
    }
    if (entry.source === 'tvmaze') {
      return await hydrateTvmazeEntry(entry);
    }
  } catch (reason) {
    console.warn('[Hoarder search] details fetch failed:', reason);
  }
  return entry;
}
