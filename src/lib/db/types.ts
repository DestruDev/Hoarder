export const MEDIA_TYPES = [
  'book',
  'movie',
  'tv',
  'anime',
  'manga',
  'manhwa',
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

export type Item = {
  id: number;
  title: string;
  mediaType: MediaType;
  status: ItemStatus;
  rating: number | null;
  notes: string | null;
  coverImageUrl: string | null;
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
};

export type NewCatalogItem = Omit<CatalogItem, 'id'>;
