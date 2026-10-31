import type { MediaType, NewCatalogItem, ReleaseStatus } from '@/lib/db/types';

import { CATALOG_SECTION_LIMIT } from '@/lib/catalog-sections';

import { fetchJson, mapInBatches } from './http';
import { cleanSynopsis, joinGenres, joinNames, seasonFromIsoDate } from './metadata';
import { scoreOutOfTen } from './rating';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const RESULTS_PER_PAGE = 20;
const PAGES_PER_TYPE = Math.ceil(CATALOG_SECTION_LIMIT / RESULTS_PER_PAGE);

type TmdbMedia = {
  id?: number | null;
  title?: string | null;
  name?: string | null;
  poster_path?: string | null;
  adult?: boolean | null;
  vote_average?: number | null;
  release_date?: string | null;
  first_air_date?: string | null;
  overview?: string | null;
};

type TmdbNamed = { name?: string | null };

type TmdbDetails = {
  number_of_episodes?: number | null;
  status?: string | null;
  vote_average?: number | null;
  overview?: string | null;
  genres?: TmdbNamed[] | null;
  production_companies?: TmdbNamed[] | null;
  networks?: TmdbNamed[] | null;
  created_by?: TmdbNamed[] | null;
};

type TmdbPage = {
  results?: TmdbMedia[] | null;
};

type MappedTmdbItem = NewCatalogItem & { tmdbId?: number };

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

function mapDateStatus(date: string | null | undefined): ReleaseStatus | null {
  const day = date?.trim();
  if (!day) {
    return null;
  }

  return day > new Date().toISOString().slice(0, 10) ? 'upcoming' : 'released';
}

function mapTvStatus(status: string | null | undefined): ReleaseStatus | null {
  switch (status) {
    case 'Ended':
    case 'Canceled':
      return 'released';
    case 'Returning Series':
    case 'In Production':
      return 'releasing';
    case 'Planned':
      return 'upcoming';
    default:
      return null;
  }
}

function mapResults(results: TmdbMedia[] | null | undefined, mediaType: MediaType): MappedTmdbItem[] {
  const items: MappedTmdbItem[] = [];

  for (const entry of results ?? []) {
    if (entry.adult) {
      continue;
    }

    const title = mapTitle(entry);
    if (!title) {
      continue;
    }

    const releaseDate = mediaType === 'movie' ? entry.release_date : entry.first_air_date;

    items.push({
      title,
      mediaType,
      coverImageUrl: mapPoster(entry.poster_path),
      releaseStatus: mapDateStatus(releaseDate),
      globalRating: scoreOutOfTen(entry.vote_average),
      season: seasonFromIsoDate(releaseDate),
      synopsis: cleanSynopsis(entry.overview),
      tmdbId: entry.id ?? undefined,
    });
  }

  return items;
}

function withoutTmdbId(item: MappedTmdbItem): NewCatalogItem {
  const { tmdbId: _tmdbId, ...rest } = item;
  return rest;
}

function names(list: TmdbNamed[] | null | undefined): Array<string | null | undefined> {
  return (list ?? []).map((entry) => entry.name);
}

async function attachDetails(
  kind: 'movie' | 'tv',
  items: MappedTmdbItem[],
  apiKey: string,
): Promise<NewCatalogItem[]> {
  return mapInBatches(items, 4, async (item) => {
    if (item.tmdbId == null) {
      return withoutTmdbId(item);
    }

    try {
      const url = `https://api.themoviedb.org/3/${kind}/${item.tmdbId}?api_key=${encodeURIComponent(apiKey)}`;
      const payload = (await fetchJson(url)) as TmdbDetails;
      const genres = joinGenres(names(payload.genres));
      const synopsis = item.synopsis ?? cleanSynopsis(payload.overview);
      const globalRating = item.globalRating ?? scoreOutOfTen(payload.vote_average);

      if (kind === 'movie') {
        return withoutTmdbId({
          ...item,
          genres,
          synopsis,
          globalRating,
          creator: joinNames(names(payload.production_companies)),
        });
      }

      const totalEpisodes =
        payload.number_of_episodes != null && payload.number_of_episodes > 0
          ? payload.number_of_episodes
          : null;

      return withoutTmdbId({
        ...item,
        genres,
        synopsis,
        globalRating,
        totalEpisodes,
        releaseStatus: mapTvStatus(payload.status) ?? item.releaseStatus,
        creator: joinNames(names(payload.networks)) ?? joinNames(names(payload.created_by)),
      });
    } catch (reason) {
      console.warn(`[Hoarder catalog] TMDB ${kind} details fetch failed:`, reason);
      return withoutTmdbId(item);
    }
  });
}

async function fetchTopRatedPages(kind: 'movie' | 'tv', apiKey: string): Promise<NewCatalogItem[]> {
  const mediaType: MediaType = kind === 'movie' ? 'movie' : 'tv';
  const items: MappedTmdbItem[] = [];

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

  return attachDetails(kind, items.slice(0, CATALOG_SECTION_LIMIT), apiKey);
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
