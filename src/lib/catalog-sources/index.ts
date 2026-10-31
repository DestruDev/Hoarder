import { SAMPLE_CATALOG } from '@/lib/db/catalog-data';
import { reportSeedProgress, type OnSeedProgress } from '@/lib/db/progress';
import type { MediaType, NewCatalogItem } from '@/lib/db/types';

import { limitCatalogBySection } from '@/lib/catalog-sections';

import { fetchAnilistCatalog } from './anilist';
import { fetchItunesCatalog } from './itunes';
import { fetchSteamCatalog } from './steam';
import { fetchTmdbCatalog } from './tmdb';
import { fetchTvmazeCatalog } from './tvmaze';

function catalogKey(item: Pick<NewCatalogItem, 'title' | 'mediaType'>): string {
  return `${item.mediaType}:${item.title.trim().toLowerCase()}`;
}

function firstDefined<T>(current: T | null | undefined, incoming: T | null | undefined): T | null | undefined {
  return current ?? incoming;
}

function mergeCatalogItem(current: NewCatalogItem, incoming: NewCatalogItem): NewCatalogItem {
  return {
    ...current,
    coverImageUrl: firstDefined(current.coverImageUrl, incoming.coverImageUrl) ?? null,
    releaseStatus: firstDefined(current.releaseStatus, incoming.releaseStatus),
    mangaOrigin: firstDefined(current.mangaOrigin, incoming.mangaOrigin),
    totalEpisodes: firstDefined(current.totalEpisodes, incoming.totalEpisodes),
    totalPages: firstDefined(current.totalPages, incoming.totalPages),
    totalChapters: firstDefined(current.totalChapters, incoming.totalChapters),
    globalRating: firstDefined(current.globalRating, incoming.globalRating),
    season: firstDefined(current.season, incoming.season),
    genres: firstDefined(current.genres, incoming.genres),
    creator: firstDefined(current.creator, incoming.creator),
    synopsis: firstDefined(current.synopsis, incoming.synopsis),
  };
}

export function dedupeCatalogItems(items: NewCatalogItem[]): NewCatalogItem[] {
  const byKey = new Map<string, NewCatalogItem>();

  for (const item of items) {
    const key = catalogKey(item);
    const existing = byKey.get(key);
    byKey.set(key, existing ? mergeCatalogItem(existing, item) : item);
  }

  return [...byKey.values()];
}

function hasMediaType(items: NewCatalogItem[], mediaType: MediaType): boolean {
  return items.some((item) => item.mediaType === mediaType);
}

function hasAmericanComics(items: NewCatalogItem[]): boolean {
  return items.some(
    (item) => item.mediaType === 'comic' && (item.mangaOrigin ?? 'american') === 'american',
  );
}

function sampleFallback(remote: NewCatalogItem[]): NewCatalogItem[] {
  const hasAnime = hasMediaType(remote, 'anime');
  const hasComics = hasMediaType(remote, 'comic');
  const hasAmerican = hasAmericanComics(remote);
  const hasMovies = hasMediaType(remote, 'movie');
  const hasTv = hasMediaType(remote, 'tv');
  const hasBooks = hasMediaType(remote, 'book');
  const hasGames = hasMediaType(remote, 'game');

  return SAMPLE_CATALOG.filter((item) => {
    if (item.mediaType === 'game') {
      return !hasGames;
    }

    if (item.mediaType === 'comic' && item.mangaOrigin === 'american') {
      return !hasAmerican;
    }

    if (item.mediaType === 'book') {
      return !hasBooks;
    }

    if (item.mediaType === 'movie') {
      return !hasMovies;
    }

    if (item.mediaType === 'tv') {
      return !hasTv;
    }

    if (item.mediaType === 'anime') {
      return !hasAnime;
    }

    if (item.mediaType === 'comic') {
      return !hasComics;
    }

    return false;
  });
}

const CATALOG_REMOTE_SOURCES = [
  { name: 'AniList', fetch: fetchAnilistCatalog },
  { name: 'TMDB', fetch: fetchTmdbCatalog },
  { name: 'TVMaze', fetch: fetchTvmazeCatalog },
  { name: 'iTunes', fetch: fetchItunesCatalog },
  { name: 'Steam', fetch: fetchSteamCatalog },
] as const;

export const CATALOG_REMOTE_SOURCE_COUNT = CATALOG_REMOTE_SOURCES.length;

export async function fetchRemoteCatalog(
  onProgress?: OnSeedProgress,
  extraSteps = 0,
): Promise<NewCatalogItem[]> {
  const total = CATALOG_REMOTE_SOURCES.length + extraSteps;
  const remote: NewCatalogItem[] = [];

  for (const [index, source] of CATALOG_REMOTE_SOURCES.entries()) {
    reportSeedProgress(onProgress, `Fetching ${source.name}…`, index, total);
    try {
      remote.push(...(await source.fetch()));
    } catch (reason) {
      console.warn(`[Hoarder catalog] ${source.name} fetch failed:`, reason);
    }
  }

  return dedupeCatalogItems(remote);
}

export async function buildCatalogEntries(
  onProgress?: OnSeedProgress,
  extraSteps = 0,
): Promise<NewCatalogItem[]> {
  const remote = await fetchRemoteCatalog(onProgress, extraSteps);
  return limitCatalogBySection(dedupeCatalogItems([...remote, ...sampleFallback(remote)]));
}
