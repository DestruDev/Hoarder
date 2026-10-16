import type { ComicOrigin, NewCatalogItem, ReleaseStatus } from '@/lib/db/types';

import { CATALOG_SECTION_LIMIT } from '@/lib/catalog-sections';

import { fetchJson } from './http';

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
      coverImage {
        large
      }
`;

const ANIME_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
      ${MEDIA_FIELDS}
    }
  }
}
`;

const MANGA_QUERY = `
query ($page: Int, $perPage: Int, $country: CountryCode) {
  Page(page: $page, perPage: $perPage) {
    media(type: MANGA, sort: POPULARITY_DESC, isAdult: false, countryOfOrigin: $country) {
      ${MEDIA_FIELDS}
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
  coverImage?: {
    large?: string | null;
  } | null;
};

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
