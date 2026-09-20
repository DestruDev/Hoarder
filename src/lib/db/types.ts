export const MEDIA_TYPES = [
  'book',
  'movie',
  'tv',
  'anime',
  'comic',
  'game',
  'other',
] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

export const ITEM_STATUSES = [
  'in_progress',
  'revisiting',
  'completed',
  'on_hold',
  'dropped',
  'planning',
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const RELEASE_STATUSES = ['upcoming', 'releasing', 'released'] as const;

export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export const SHOW_MEDIA_TYPES = ['tv', 'anime'] as const;

export function isShowMediaType(mediaType: MediaType): boolean {
  return mediaType === 'tv' || mediaType === 'anime';
}

export const COMIC_ORIGINS = ['japanese', 'south_korean', 'chinese', 'american'] as const;

export type ComicOrigin = (typeof COMIC_ORIGINS)[number];

export function isComicMediaType(mediaType: MediaType): boolean {
  return mediaType === 'comic';
}

export function isPagedMediaType(
  mediaType: MediaType,
  mangaOrigin?: ComicOrigin | null,
): boolean {
  if (mediaType === 'book') {
    return true;
  }

  return mediaType === 'comic' && (mangaOrigin ?? 'american') === 'american';
}

export function isChapteredMediaType(
  mediaType: MediaType,
  mangaOrigin?: ComicOrigin | null,
): boolean {
  if (mediaType !== 'comic') {
    return false;
  }

  const origin = mangaOrigin ?? 'american';
  return origin === 'japanese' || origin === 'south_korean' || origin === 'chinese';
}

export type Item = {
  id: number;
  title: string;
  mediaType: MediaType;
  status: ItemStatus;
  rating: number | null;
  notes: string | null;
  coverImageUrl: string | null;
  releaseStatus: ReleaseStatus | null;
  mangaOrigin: ComicOrigin | null;
  totalEpisodes: number | null;
  totalPages: number | null;
  totalChapters: number | null;
  currentEpisodes: number | null;
  currentPages: number | null;
  currentChapters: number | null;
  dateAdded: string;
  finishDate: string | null;
};

export type NewItemInput = Omit<Item, 'id' | 'dateAdded'> & {
  dateAdded?: string;
};

export type ItemFilters = {
  mediaType?: MediaType;
  status?: ItemStatus;
};

export type Profile = {
  name: string | null;
  description: string | null;
  avatarUrl: string | null;
};

export type CatalogItem = {
  id: number;
  title: string;
  mediaType: MediaType;
  coverImageUrl: string | null;
  releaseStatus: ReleaseStatus | null;
  mangaOrigin: ComicOrigin | null;
  totalEpisodes: number | null;
  totalPages: number | null;
  totalChapters: number | null;
};

export type NewCatalogItem = Omit<
  CatalogItem,
  'id' | 'releaseStatus' | 'mangaOrigin' | 'totalEpisodes' | 'totalPages' | 'totalChapters'
> & {
  releaseStatus?: ReleaseStatus | null;
  mangaOrigin?: ComicOrigin | null;
  totalEpisodes?: number | null;
  totalPages?: number | null;
  totalChapters?: number | null;
};
