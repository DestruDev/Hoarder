import { COMIC_ORIGINS, MEDIA_TYPES, type ComicOrigin, type FeedKind, type MediaType } from '@/lib/db/types';
import { COMIC_ORIGIN_LABELS, MEDIA_TYPE_LABELS } from '@/lib/status-labels';

export type ComicFilterValue = `comic:${ComicOrigin}`;
export type MediaFilterValue = MediaType | ComicFilterValue;
export type MediaFilterOption = MediaFilterValue | null;
export type MediaBrowseFilter = MediaFilterValue[];

export function comicFilterValue(origin: ComicOrigin): ComicFilterValue {
  return `comic:${origin}`;
}

export function getMediaFilterOptions(): {
  value: MediaFilterOption;
  label: string;
}[] {
  const options: { value: MediaFilterOption; label: string }[] = [{ value: null, label: 'All' }];

  for (const type of MEDIA_TYPES) {
    if (type === 'comic') {
      for (const origin of COMIC_ORIGINS) {
        options.push({
          value: comicFilterValue(origin),
          label: COMIC_ORIGIN_LABELS[origin],
        });
      }
      continue;
    }

    options.push({ value: type, label: MEDIA_TYPE_LABELS[type] });
  }

  return options;
}

export const FEED_FILTERS = ['your', 'friend', 'notification'] as const;

export type FeedFilterValue = (typeof FEED_FILTERS)[number];
export type FeedFilterOption = FeedFilterValue | 'all';
export type FeedFilter = FeedFilterValue[];

export const FEED_FILTER_OPTIONS: { value: FeedFilterOption; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'your', label: 'Your Feed' },
  { value: 'friend', label: 'Friend Feed' },
  { value: 'notification', label: 'Notification Feed' },
];

export function matchesSearchText(text: string | null | undefined, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  if (!text) {
    return false;
  }

  return text.toLowerCase().includes(normalizedQuery);
}

export function matchesMediaName(title: string | null | undefined, query: string): boolean {
  return matchesSearchText(title, query);
}

export function matchesAnySearchText(
  query: string,
  ...parts: Array<string | null | undefined>
): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return parts.some((part) => matchesSearchText(part, query));
}

export function matchesMediaTypeFilter(
  item: { mediaType: MediaType; mangaOrigin?: ComicOrigin | null },
  filter: MediaBrowseFilter,
): boolean {
  if (filter.length === 0) {
    return true;
  }

  if (item.mediaType !== 'comic') {
    return filter.includes(item.mediaType);
  }

  if (filter.includes('comic')) {
    return true;
  }

  return filter.includes(comicFilterValue(item.mangaOrigin ?? 'american'));
}

export function isMediaFilterSelected(
  filter: MediaBrowseFilter,
  option: MediaFilterOption,
): boolean {
  if (option === null) {
    return filter.length === 0;
  }

  return filter.includes(option);
}

export function toggleMediaFilter(
  filter: MediaBrowseFilter,
  option: MediaFilterOption,
): MediaBrowseFilter {
  if (option === null) {
    return [];
  }

  if (filter.includes(option)) {
    return filter.filter((value) => value !== option);
  }

  return [...filter, option];
}

export function isFeedFilterSelected(
  filter: FeedFilter,
  option: FeedFilterOption,
): boolean {
  if (option === 'all') {
    return filter.length === 0;
  }

  return filter.includes(option);
}

export function toggleFeedFilter(
  filter: FeedFilter,
  option: FeedFilterOption,
): FeedFilter {
  if (option === 'all') {
    return [];
  }

  if (filter.includes(option)) {
    return filter.filter((value) => value !== option);
  }

  return [...filter, option];
}

export function matchesFeedFilter(
  item: { kind: FeedKind },
  filter: FeedFilter,
): boolean {
  if (filter.length === 0 || filter.includes('your')) {
    return true;
  }

  if (filter.includes('friend') && item.kind === 'friend') {
    return true;
  }

  if (filter.includes('notification') && item.kind === 'media') {
    return true;
  }

  return false;
}

export function matchesFeedSearch(
  item: { title?: string | null; body?: string | null; mediaTitle?: string | null },
  query: string,
  catalogTitle?: string | null,
): boolean {
  return matchesAnySearchText(query, catalogTitle, item.mediaTitle, item.body, item.title);
}
