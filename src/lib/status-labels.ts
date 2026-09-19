import type { ComicOrigin, ItemStatus, MediaType, ReleaseStatus } from '@/lib/db/types';

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
  comic: 'Comic',
  game: 'Game',
  other: 'Other',
};

export const COMIC_ORIGIN_LABELS: Record<ComicOrigin, string> = {
  japanese: 'Japanese',
  south_korean: 'South Korean',
  chinese: 'Chinese',
};

export const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = {
  upcoming: 'Upcoming',
  releasing: 'Releasing',
  released: 'Released',
};

export function mediaTypeLabel(
  mediaType: MediaType,
  mangaOrigin?: ComicOrigin | null,
): string {
  if (mediaType === 'comic' && mangaOrigin) {
    return `Comic (${COMIC_ORIGIN_LABELS[mangaOrigin]})`;
  }

  return MEDIA_TYPE_LABELS[mediaType];
}
