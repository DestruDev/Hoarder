import type { ComicOrigin, NewCatalogItem, ReleaseStatus } from '@/lib/db/types';

import { CATALOG_SECTION_LIMIT } from '@/lib/catalog-sections';

import { fetchJson } from './http';
import { cleanSynopsis, isoDateFromParts, joinGenres, joinNames, seasonLabel } from './metadata';
import { scoreOutOfTen } from './rating';

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const SKIP_FORMATS = new Set(['MUSIC', 'NOVEL']);
const PER_PAGE = 50;
const PAGE_COUNT = Math.ceil(CATALOG_SECTION_LIMIT / PER_PAGE);

export const MEDIA_FIELDS = `
      id
      title {
        english
        romaji
        native
      }
      format
      status
      countryOfOrigin
      episodes
      chapters
      averageScore
      season
      seasonYear
      startDate {
        year
        month
        day
      }
      genres
      description(asHtml: false)
      coverImage {
        large
      }
`;

const ANIME_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
      ${MEDIA_FIELDS}
      studios(isMain: true) {
        nodes {
          name
        }
      }
    }
  }
}
`;

const MANGA_QUERY = `
query ($page: Int, $perPage: Int, $country: CountryCode) {
  Page(page: $page, perPage: $perPage) {
    media(type: MANGA, sort: POPULARITY_DESC, isAdult: false, countryOfOrigin: $country) {
      ${MEDIA_FIELDS}
      staff(perPage: 6, sort: [RELEVANCE]) {
        edges {
          role
          node {
            name {
              full
            }
          }
        }
      }
    }
  }
}
`;

type AnilistTitle = {
  english?: string | null;
  romaji?: string | null;
  native?: string | null;
};

export type AnilistMedia = {
  id?: number | null;
  title?: AnilistTitle | null;
  format?: string | null;
  status?: string | null;
  countryOfOrigin?: string | null;
  episodes?: number | null;
  chapters?: number | null;
  averageScore?: number | null;
  season?: string | null;
  seasonYear?: number | null;
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;
  genres?: string[] | null;
  description?: string | null;
  coverImage?: {
    large?: string | null;
  } | null;
  studios?: {
    nodes?: Array<{ name?: string | null } | null> | null;
  } | null;
  staff?: {
    edges?: Array<{
      role?: string | null;
      node?: { name?: { full?: string | null } | null } | null;
    } | null> | null;
  } | null;
};

const AUTHOR_ROLES = [/^original (story|creator)/i, /^story & art/i, /^story/i];

const ANILIST_SEASONS: Record<string, string> = {
  WINTER: 'Winter',
  SPRING: 'Spring',
  SUMMER: 'Summer',
  FALL: 'Fall',
};

function mapSeason(media: AnilistMedia): string | null {
  const season = media.season ? ANILIST_SEASONS[media.season] : undefined;
  if (season && media.seasonYear) {
    return `${season} ${media.seasonYear}`;
  }

  return seasonLabel(media.startDate?.year, media.startDate?.month);
}

function mapAuthor(media: AnilistMedia): string | null {
  const edges = media.staff?.edges ?? [];

  for (const pattern of AUTHOR_ROLES) {
    const match = edges.find((edge) => edge?.role && pattern.test(edge.role));
    const name = match?.node?.name?.full?.trim();
    if (name) {
      return name;
    }
  }

  return edges[0]?.node?.name?.full?.trim() || null;
}

function mapCreator(media: AnilistMedia): string | null {
  return joinNames(media.studios?.nodes?.map((node) => node?.name)) ?? mapAuthor(media);
}

type AnilistResponse = {
  data?: {
    Page?: {
      media?: Array<AnilistMedia | null> | null;
    };
  };
};

function pickTitle(title: AnilistTitle | null | undefined): string | null {
  const value = title?.english || title?.romaji || title?.native;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function mapReleaseStatus(status: string | null | undefined): ReleaseStatus | null {
  switch (status) {
    case 'FINISHED':
      return 'released';
    case 'CANCELLED':
      return 'cancelled';
    case 'RELEASING':
    case 'HIATUS':
      return 'releasing';
    case 'NOT_YET_RELEASED':
      return 'upcoming';
    default:
      return null;
  }
}

export function mapComicOrigin(country: string | null | undefined): ComicOrigin | null {
  switch (country) {
    case 'JP':
      return 'japanese';
    case 'KR':
      return 'south_korean';
    case 'CN':
    case 'TW':
      return 'chinese';
    default:
      return null;
  }
}

export function mapMedia(media: AnilistMedia, mediaType: 'anime' | 'comic'): NewCatalogItem | null {
  if (media.format && SKIP_FORMATS.has(media.format)) {
    return null;
  }

  const title = pickTitle(media.title);
  if (!title) {
    return null;
  }

  return {
    title,
    mediaType,
    coverImageUrl: media.coverImage?.large ?? null,
    releaseStatus: mapReleaseStatus(media.status),
    mangaOrigin: mediaType === 'comic' ? mapComicOrigin(media.countryOfOrigin) ?? 'japanese' : null,
    totalEpisodes: mediaType === 'anime' ? media.episodes ?? null : null,
    totalChapters: mediaType === 'comic' ? media.chapters ?? null : null,
    globalRating: scoreOutOfTen(media.averageScore, 100),
    season: mapSeason(media),
    releaseDate: isoDateFromParts(media.startDate?.year, media.startDate?.month, media.startDate?.day),
    genres: joinGenres(media.genres),
    creator: mapCreator(media),
    synopsis: cleanSynopsis(media.description),
    source: media.id != null ? 'anilist' : null,
    externalId: media.id != null ? String(media.id) : null,
  };
}

function mapPage(payload: AnilistResponse, mediaType: 'anime' | 'comic'): NewCatalogItem[] {
  const items: NewCatalogItem[] = [];

  for (const media of payload.data?.Page?.media ?? []) {
    if (!media) {
      continue;
    }

    const mapped = mapMedia(media, mediaType);
    if (mapped) {
      items.push(mapped);
    }
  }

  return items;
}

export async function fetchAnilist<T = AnilistResponse>(
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  return (await fetchJson(ANILIST_ENDPOINT, {
    method: 'POST',
    signal,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })) as T;
}

async function fetchAnilistSection(
  mediaType: 'anime' | 'comic',
  query: string,
  variables: Record<string, unknown>,
): Promise<NewCatalogItem[]> {
  const items: NewCatalogItem[] = [];

  for (let page = 1; page <= PAGE_COUNT; page += 1) {
    try {
      const payload = await fetchAnilist(query, { ...variables, page, perPage: PER_PAGE });
      const mapped = mapPage(payload, mediaType);
      if (mapped.length === 0) {
        break;
      }
      items.push(...mapped);
    } catch (reason) {
      console.warn('[Hoarder catalog] AniList page fetch failed:', reason);
      break;
    }

    if (items.length >= CATALOG_SECTION_LIMIT) {
      break;
    }
  }

  return items.slice(0, CATALOG_SECTION_LIMIT);
}

export async function fetchAnilistCatalog(): Promise<NewCatalogItem[]> {
  const anime = await fetchAnilistSection('anime', ANIME_QUERY, {});
  const mangaJP = await fetchAnilistSection('comic', MANGA_QUERY, { country: 'JP' });
  const mangaKR = await fetchAnilistSection('comic', MANGA_QUERY, { country: 'KR' });
  const mangaCN = await fetchAnilistSection('comic', MANGA_QUERY, { country: 'CN' });

  return [...anime, ...mangaJP, ...mangaKR, ...mangaCN];
}

const SEARCH_ANIME_PAGE = `
  anime: Page(perPage: $perPage) {
    media(search: $search, type: ANIME, isAdult: false, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
      ${MEDIA_FIELDS}
      studios(isMain: true) {
        nodes {
          name
        }
      }
    }
  }
`;

const SEARCH_MANGA_PAGE = `
  manga: Page(perPage: $perPage) {
    media(search: $search, type: MANGA, isAdult: false, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
      ${MEDIA_FIELDS}
      staff(perPage: 6, sort: [RELEVANCE]) {
        edges {
          role
          node {
            name {
              full
            }
          }
        }
      }
    }
  }
`;

type AnilistSearchResponse = {
  data?: {
    anime?: { media?: Array<AnilistMedia | null> | null } | null;
    manga?: { media?: Array<AnilistMedia | null> | null } | null;
  };
};

// Anime and manga share one request (aliased pages) to stay under AniList's rate limit.
export async function searchAnilist(
  query: string,
  kinds: { anime: boolean; comic: boolean },
  perPage: number,
  signal?: AbortSignal,
): Promise<NewCatalogItem[]> {
  if (!kinds.anime && !kinds.comic) {
    return [];
  }

  const pages = `${kinds.anime ? SEARCH_ANIME_PAGE : ''}${kinds.comic ? SEARCH_MANGA_PAGE : ''}`;
  const payload = await fetchAnilist<AnilistSearchResponse>(
    `query ($search: String, $perPage: Int) {${pages}}`,
    { search: query, perPage },
    signal,
  );

  return [
    ...mapPage({ data: { Page: { media: payload.data?.anime?.media } } }, 'anime'),
    ...mapPage({ data: { Page: { media: payload.data?.manga?.media } } }, 'comic'),
  ];
}
