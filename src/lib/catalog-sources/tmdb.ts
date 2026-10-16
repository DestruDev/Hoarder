import type { MediaType, NewCatalogItem } from '@/lib/db/types';

import { CATALOG_SECTION_LIMIT } from '@/lib/catalog-sections';

import { fetchJson } from './http';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const RESULTS_PER_PAGE = 20;
const PAGES_PER_TYPE = Math.ceil(CATALOG_SECTION_LIMIT / RESULTS_PER_PAGE);

type TmdbMedia = {
  title?: string | null;
  name?: string | null;
  poster_path?: string | null;
  adult?: boolean | null;
};

type TmdbPage = {
  results?: TmdbMedia[] | null;
};

function tmdbApiKey(): string | undefined {
  const key = process.env.EXPO_PUBLIC_TMDB_API_KEY;
  const trimmed = key?.trim();
  return trimmed ? trimmed : undefined;
}

function mapTitle(entry: TmdbMedia): string | null {
  const value = entry.title || entry.name;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function mapPoster(path: string | null | undefined): string | null {
  if (!path) {
    return null;
  }

  return `${TMDB_IMAGE_BASE}${path}`;
}

function mapResults(results: TmdbMedia[] | null | undefined, mediaType: MediaType): NewCatalogItem[] {
  const items: NewCatalogItem[] = [];

  for (const entry of results ?? []) {
    if (entry.adult) {
      continue;
    }

    const title = mapTitle(entry);
    if (!title) {
      continue;
    }

    items.push({
      title,
      mediaType,
      coverImageUrl: mapPoster(entry.poster_path),
    });
  }

  return items;
}

async function fetchTopRatedPages(kind: 'movie' | 'tv', apiKey: string): Promise<NewCatalogItem[]> {
  const mediaType: MediaType = kind === 'movie' ? 'movie' : 'tv';
  const items: NewCatalogItem[] = [];

  for (let page = 1; page <= PAGES_PER_TYPE; page += 1) {
    const url = `https://api.themoviedb.org/3/${kind}/top_rated?api_key=${encodeURIComponent(apiKey)}&page=${page}`;
    const payload = (await fetchJson(url)) as TmdbPage;
    const mapped = mapResults(payload.results, mediaType);
    if (mapped.length === 0) {
      break;
    }
    items.push(...mapped);
    if (items.length >= CATALOG_SECTION_LIMIT) {
      break;
    }
  }

  return items.slice(0, CATALOG_SECTION_LIMIT);
}

export async function fetchTmdbCatalog(): Promise<NewCatalogItem[]> {
  const apiKey = tmdbApiKey();
  if (!apiKey) {
    return [];
  }

  const movies = await fetchTopRatedPages('movie', apiKey);
  const shows = await fetchTopRatedPages('tv', apiKey);
  return [...movies, ...shows];
}
