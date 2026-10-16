import type { ComicOrigin, MediaType, NewCatalogItem } from '@/lib/db/types';

export const CATALOG_SECTION_LIMIT = 100;

export const CATALOG_SECTIONS: {
  id: string;
  title: string;
  types: MediaType[];
  origin?: ComicOrigin;
}[] = [
  { id: 'tv', title: 'Top TV', types: ['tv'] },
  { id: 'game', title: 'Top Games', types: ['game'] },
  { id: 'anime', title: 'Top Anime', types: ['anime'] },
  { id: 'manga', title: 'Top Manga', types: ['comic'], origin: 'japanese' },
  { id: 'manhwa', title: 'Top Manhwa', types: ['comic'], origin: 'south_korean' },
  { id: 'manhua', title: 'Top Manhua', types: ['comic'], origin: 'chinese' },
  { id: 'comic', title: 'Top Comics', types: ['comic'], origin: 'american' },
  { id: 'book', title: 'Top Books', types: ['book'] },
];

export function catalogSectionKey(item: {
  mediaType: MediaType;
  mangaOrigin?: ComicOrigin | null;
}): string {
  if (item.mediaType === 'comic') {
    return `comic:${item.mangaOrigin ?? 'american'}`;
  }

  return item.mediaType;
}

export function limitCatalogBySection<T extends NewCatalogItem>(
  items: T[],
  limit = CATALOG_SECTION_LIMIT,
): T[] {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = catalogSectionKey(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  const limited: T[] = [];

  for (const list of groups.values()) {
    limited.push(...list.slice(0, limit));
  }

  return limited;
}
