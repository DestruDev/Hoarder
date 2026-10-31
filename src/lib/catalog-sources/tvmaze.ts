import { SAMPLE_CATALOG } from '@/lib/db/catalog-data';
import type { NewCatalogItem, ReleaseStatus } from '@/lib/db/types';

import { fetchJson, mapInBatches } from './http';
import { cleanSynopsis, joinGenres, seasonFromIsoDate } from './metadata';
import { scoreOutOfTen } from './rating';

const EXTRA_TITLES = [
  'Breaking Bad',
  'The Wire',
  'The Sopranos',
  'Game of Thrones',
  'The Office',
  'Friends',
  'Seinfeld',
  'The Simpsons',
  'Mad Men',
  'Better Call Saul',
  'Succession',
  'Chernobyl',
  'Band of Brothers',
  'The Twilight Zone',
  'Twin Peaks',
  'The West Wing',
  'Fargo',
  'True Detective',
  'Black Mirror',
  'The Last of Us',
  'Stranger Things',
  'Avatar: The Last Airbender',
  'The Bear',
  'Andor',
  'Shogun',
  'Severance',
  'The Boys',
  'House of the Dragon',
  'The Mandalorian',
  'Arcane',
  'Dark',
  'Mr. Robot',
  'Fleabag',
  'Parks and Recreation',
  'Arrested Development',
  'It\'s Always Sunny in Philadelphia',
  'M*A*S*H',
  'I Love Lucy',
  'Planet Earth',
  'The Expanse',
];

type TvmazeSeason = {
  number?: number | null;
  episodeOrder?: number | null;
};

type TvmazeShow = {
  name?: string | null;
  status?: string | null;
  premiered?: string | null;
  genres?: string[] | null;
  summary?: string | null;
  network?: { name?: string | null } | null;
  webChannel?: { name?: string | null } | null;
  rating?: {
    average?: number | null;
  } | null;
  image?: {
    original?: string | null;
    medium?: string | null;
  } | null;
  _embedded?: {
    seasons?: TvmazeSeason[] | null;
  } | null;
};

function sampleTvTitles(): string[] {
  return SAMPLE_CATALOG.filter((item) => item.mediaType === 'tv').map((item) => item.title);
}

function uniqueTitles(): string[] {
  const titles = [...sampleTvTitles(), ...EXTRA_TITLES];
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const title of titles) {
    const key = title.trim().toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(title);
  }

  return unique;
}

function mapReleaseStatus(status: string | null | undefined): ReleaseStatus | null {
  switch (status) {
    case 'Ended':
      return 'released';
    case 'Running':
    case 'To Be Determined':
      return 'releasing';
    case 'In Development':
      return 'upcoming';
    default:
      return null;
  }
}

function countEpisodes(seasons: TvmazeSeason[] | null | undefined): number | null {
  if (!seasons?.length) {
    return null;
  }

  let total = 0;
  let counted = false;

  for (const season of seasons) {
    if (season.number == null || season.number < 1) {
      continue;
    }

    if (season.episodeOrder == null || season.episodeOrder < 0) {
      continue;
    }

    total += season.episodeOrder;
    counted = true;
  }

  return counted ? total : null;
}

function mapShow(show: TvmazeShow | null | undefined): NewCatalogItem | null {
  const title = show?.name?.trim();
  const coverImageUrl = show?.image?.original || show?.image?.medium || null;

  if (!show || !title || !coverImageUrl) {
    return null;
  }

  return {
    title,
    mediaType: 'tv',
    coverImageUrl,
    releaseStatus: mapReleaseStatus(show?.status),
    totalEpisodes: countEpisodes(show._embedded?.seasons),
    globalRating: scoreOutOfTen(show.rating?.average),
    season: seasonFromIsoDate(show.premiered),
    genres: joinGenres(show.genres),
    creator: show.network?.name?.trim() || show.webChannel?.name?.trim() || null,
    synopsis: cleanSynopsis(show.summary),
  };
}

async function searchShow(title: string): Promise<NewCatalogItem | null> {
  try {
    const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(title)}&embed=seasons`;
    const show = (await fetchJson(url)) as TvmazeShow;
    return mapShow(show);
  } catch {
    return null;
  }
}

export async function fetchTvmazeCatalog(): Promise<NewCatalogItem[]> {
  return mapInBatches(uniqueTitles(), 3, searchShow);
}
