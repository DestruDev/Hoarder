import type { ItemStatus, MediaType, ReleaseStatus } from '@/lib/db/types';

export const STATUS_LABELS: Record<ItemStatus, string> = {
  planning: 'Planning',
  in_progress: 'In Progress',
  completed: 'Completed',
  dropped: 'Dropped',
  on_hold: 'On Hold',
};

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  book: 'Books',
  movie: 'Movies',
  tv: 'TV',
  anime: 'Anime',
  manga: 'Manga',
  manhwa: 'Manhwa',
  game: 'Game',
  other: 'Other',
};

export const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = {
  upcoming: 'Upcoming',
  releasing: 'Releasing',
  released: 'Released',
};
