import type { ComicOrigin, NewCatalogItem, ReleaseStatus } from '@/lib/db/types';

import { CATALOG_SECTION_LIMIT } from '@/lib/catalog-sections';

import { fetchJson } from './http';
import { cleanSynopsis, joinGenres, joinNames, seasonLabel } from './metadata';
import { scoreOutOfTen } from './rating';

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const SKIP_FORMATS = new Set(['MUSIC', 'NOVEL']);
const PER_PAGE = 50;
const PAGE_COUNT = Math.ceil(CATALOG_SECTION_LIMIT / PER_PAGE);

const MEDIA_FIELDS = `
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

type AnilistMedia = {
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
    case 'CANCELLED':
      return 'released';
    case 'RELEASING':
    case 'HIATUS':
      return 'releasing';
    case 'NOT_YET_RELEASED':
      return 'upcoming';
    default:
      return null;
  }
}

function mapComicOrigin(country: string | null | undefined): ComicOrigin | null {
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

function mapMedia(media: AnilistMedia, mediaType: 'anime' | 'comic'): NewCatalogItem | null {
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
    genres: joinGenres(media.genres),
    creator: mapCreator(media),
    synopsis: cleanSynopsis(media.description),
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

async function fetchAnilist(query: string, variables: Record<string, unknown>): Promise<AnilistResponse> {
  return (await fetchJson(ANILIST_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })) as AnilistResponse;
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
