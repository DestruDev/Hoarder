import { SAMPLE_CATALOG } from '@/lib/db/catalog-data';
import type { NewCatalogItem, ReleaseStatus } from '@/lib/db/types';

import { fetchJson, mapInBatches } from './http';

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

type TvmazeShow = {
  name?: string | null;
  status?: string | null;
  image?: {
    original?: string | null;
    medium?: string | null;
  } | null;
};

type TvmazeSearchResult = {
  show?: TvmazeShow | null;
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

function mapShow(show: TvmazeShow | null | undefined): NewCatalogItem | null {
  const title = show?.name?.trim();
  const coverImageUrl = show?.image?.original || show?.image?.medium || null;

  if (!title || !coverImageUrl) {
    return null;
  }

  return {
    title,
    mediaType: 'tv',
    coverImageUrl,
    releaseStatus: mapReleaseStatus(show?.status),
  };
}

async function searchShow(title: string): Promise<NewCatalogItem | null> {
  const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`;
  const results = (await fetchJson(url)) as TvmazeSearchResult[];
  const withCover = results.find((result) => mapShow(result.show));
  return mapShow(withCover?.show);
}

export async function fetchTvmazeCatalog(): Promise<NewCatalogItem[]> {
  return mapInBatches(uniqueTitles(), 3, searchShow);
}
