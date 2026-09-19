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
  'planning',
  'in_progress',
  'completed',
  'dropped',
  'on_hold',
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const RELEASE_STATUSES = ['upcoming', 'releasing', 'released'] as const;

export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export const SHOW_MEDIA_TYPES = ['tv', 'anime'] as const;

export function isShowMediaType(mediaType: MediaType): boolean {
  return mediaType === 'tv' || mediaType === 'anime';
}

export const COMIC_ORIGINS = ['japanese', 'south_korean', 'chinese'] as const;

export type ComicOrigin = (typeof COMIC_ORIGINS)[number];

export function isComicMediaType(mediaType: MediaType): boolean {
  return mediaType === 'comic';
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
  dateAdded: string;
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
};

export type NewCatalogItem = Omit<CatalogItem, 'id' | 'releaseStatus' | 'mangaOrigin'> & {
  releaseStatus?: ReleaseStatus | null;
  mangaOrigin?: ComicOrigin | null;
};
