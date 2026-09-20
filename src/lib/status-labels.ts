import {
  isChapteredMediaType,
  isPagedMediaType,
  isShowMediaType,
  type ComicOrigin,
  type ItemStatus,
  type MediaType,
  type ReleaseStatus,
} from '@/lib/db/types';

export const STATUS_LABELS: Record<ItemStatus, string> = {
  in_progress: 'In Progress',
  revisiting: 'Revisiting',
  completed: 'Completed',
  on_hold: 'On Hold',
  dropped: 'Dropped',
  planning: 'Plan to Start',
};

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  book: 'Book',
  movie: 'Movies',
  tv: 'TV',
  anime: 'Anime',
  comic: 'Comic',
  game: 'Game',
  other: 'Other',
};

export const COMIC_ORIGIN_LABELS: Record<ComicOrigin, string> = {
  japanese: 'Manga',
  south_korean: 'Manhwa',
  chinese: 'Manhua',
  american: 'Comic',
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
  if (mediaType === 'comic') {
    return COMIC_ORIGIN_LABELS[mangaOrigin ?? 'american'];
  }

  return MEDIA_TYPE_LABELS[mediaType];
}

export function progressCountLabel(
  current?: number | null,
  total?: number | null,
  singular = 'item',
  plural = 'items',
): string | null {
  const hasCurrent = current != null && current >= 0;
  const hasTotal = total != null && total >= 0;

  if (hasCurrent && hasTotal) {
    return `${current} / ${total} ${total === 1 ? singular : plural}`;
  }

  if (hasTotal) {
    return total === 1 ? `1 ${singular}` : `${total} ${plural}`;
  }

  if (hasCurrent) {
    return current === 1 ? `1 ${singular}` : `${current} ${plural}`;
  }

  return null;
}

export function progressValueLabel(
  current?: number | null,
  total?: number | null,
): string | null {
  const hasCurrent = current != null && current >= 0;
  const hasTotal = total != null && total >= 0;

  if (hasCurrent && hasTotal) {
    return `${current} / ${total}`;
  }

  if (hasTotal) {
    return String(total);
  }

  if (hasCurrent) {
    return String(current);
  }

  return null;
}

export function libraryCountLabel(
  mediaType: MediaType,
  {
    mangaOrigin,
    currentEpisodes,
    totalEpisodes,
    currentPages,
    totalPages,
    currentChapters,
    totalChapters,
  }: {
    mangaOrigin?: ComicOrigin | null;
    currentEpisodes?: number | null;
    totalEpisodes?: number | null;
    currentPages?: number | null;
    totalPages?: number | null;
    currentChapters?: number | null;
    totalChapters?: number | null;
  } = {},
): string {
  if (mediaType === 'movie') {
    return 'Movie';
  }

  if (isShowMediaType(mediaType)) {
    return (
      progressCountLabel(currentEpisodes, totalEpisodes, 'episode', 'episodes') ??
      mediaTypeLabel(mediaType, mangaOrigin)
    );
  }

  if (isChapteredMediaType(mediaType, mangaOrigin)) {
    return (
      progressCountLabel(currentChapters, totalChapters, 'chapter', 'chapters') ??
      mediaTypeLabel(mediaType, mangaOrigin)
    );
  }

  if (isPagedMediaType(mediaType, mangaOrigin)) {
    return (
      progressCountLabel(currentPages, totalPages, 'page', 'pages') ??
      mediaTypeLabel(mediaType, mangaOrigin)
    );
  }

  return mediaTypeLabel(mediaType, mangaOrigin);
}
