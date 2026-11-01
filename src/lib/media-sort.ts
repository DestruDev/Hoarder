import {
  isChapteredMediaType,
  isPagedMediaType,
  isShowMediaType,
  type CatalogItem,
  type Item,
} from '@/lib/db/types';

export const SORT_OPTIONS = [
  { key: 'alphabetical', label: 'Alphabetical' },
  { key: 'last_updated', label: 'Last Updated' },
  { key: 'date_added', label: 'Date Added' },
  { key: 'rating', label: 'Rating' },
  { key: 'global_rating', label: 'Global Rating' },
  { key: 'start_date', label: 'Start Date' },
  { key: 'finish_date', label: 'Finish Date' },
  { key: 'release_date', label: 'Release Date' },
  { key: 'amount_completed', label: 'Amount Completed' },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]['key'];
export type SortDirection = 'asc' | 'desc';
export type MediaSort = { key: SortKey; direction: SortDirection };

export type BrowseTab = 'library' | 'explore';

export const DEFAULT_SORTS: Record<BrowseTab, MediaSort> = {
  library: { key: 'alphabetical', direction: 'asc' },
  explore: { key: 'global_rating', direction: 'desc' },
};

export function browseTabFor(tab: string | null | undefined): BrowseTab {
  return tab === 'explore' ? 'explore' : 'library';
}

export function isSortActive(sort: MediaSort, tab: BrowseTab): boolean {
  const fallback = DEFAULT_SORTS[tab];
  return sort.key !== fallback.key || sort.direction !== fallback.direction;
}

export function sortLabel(key: SortKey): string {
  return SORT_OPTIONS.find((option) => option.key === key)?.label ?? key;
}

export type SortableEntry = {
  title: string;
  library?: Item | null;
  catalog?: CatalogItem | null;
};

const SEASON_ORDER = ['winter', 'spring', 'summer', 'fall'];

export function defaultSortDirection(key: SortKey): SortDirection {
  return key === 'alphabetical' ? 'asc' : 'desc';
}

export function selectSort(current: MediaSort, key: SortKey): MediaSort {
  if (current.key === key) {
    return current;
  }

  return { key, direction: defaultSortDirection(key) };
}

export function flipSortDirection(current: MediaSort): MediaSort {
  return { ...current, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

export function catalogKey(item: { title: string; mediaType: string }): string {
  return `${item.mediaType}:${item.title.trim().toLowerCase()}`;
}

function timestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function seasonValue(season: string | null | undefined): number | null {
  const match = season?.trim().match(/^(?:(winter|spring|summer|fall)\s+)?(\d{4})$/i);
  if (!match) {
    return null;
  }

  const index = match[1] ? SEASON_ORDER.indexOf(match[1].toLowerCase()) : 0;
  return Number(match[2]) * 10000 + (index * 3 + 1) * 100 + 1;
}

function releaseDateValue(date: string | null | undefined): number | null {
  const match = date?.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!match) {
    return null;
  }

  return Number(match[1]) * 10000 + Number(match[2] ?? 1) * 100 + Number(match[3] ?? 1);
}

function progressParts(entry: SortableEntry): { current: number | null; total: number | null } {
  const item = entry.library;
  if (!item) {
    return { current: null, total: null };
  }

  const completed = item.status === 'completed';

  if (isShowMediaType(item.mediaType)) {
    const total = entry.catalog?.totalEpisodes ?? item.totalEpisodes;
    return { current: completed ? (total ?? item.currentEpisodes) : item.currentEpisodes, total };
  }

  if (isChapteredMediaType(item.mediaType, item.mangaOrigin)) {
    const total = item.totalChapters ?? entry.catalog?.totalChapters ?? null;
    return { current: completed ? (total ?? item.currentChapters) : item.currentChapters, total };
  }

  if (isPagedMediaType(item.mediaType, item.mangaOrigin)) {
    const total = item.totalPages ?? entry.catalog?.totalPages ?? null;
    return { current: completed ? (total ?? item.currentPages) : item.currentPages, total };
  }

  return { current: completed ? 1 : null, total: 1 };
}

function sortValue(entry: SortableEntry, key: SortKey): number | null {
  const item = entry.library;

  switch (key) {
    case 'last_updated':
      return timestamp(item?.updatedAt ?? item?.dateAdded);
    case 'date_added':
      return timestamp(item?.dateAdded);
    case 'rating':
      return item?.rating ?? null;
    case 'global_rating':
      return entry.catalog?.globalRating ?? null;
    case 'start_date':
      return timestamp(item?.startDate ?? item?.dateAdded);
    case 'finish_date':
      return timestamp(item?.finishDate);
    case 'release_date':
      return releaseDateValue(entry.catalog?.releaseDate) ?? seasonValue(entry.catalog?.season);
    case 'amount_completed': {
      const { current, total } = progressParts(entry);
      return current != null && total != null && total > 0 ? current / total : null;
    }
    default:
      return null;
  }
}

export function sortEntries<T>(list: T[], sort: MediaSort, toEntry: (value: T) => SortableEntry): T[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  const decorated = list.map((value, index) => ({ value, index, entry: toEntry(value) }));

  decorated.sort((left, right) => {
    if (sort.key === 'alphabetical') {
      const byTitle = left.entry.title.localeCompare(right.entry.title, undefined, { sensitivity: 'base' });
      return byTitle !== 0 ? byTitle * sign : left.index - right.index;
    }

    const leftValue = sortValue(left.entry, sort.key);
    const rightValue = sortValue(right.entry, sort.key);

    if (leftValue == null || rightValue == null) {
      if (leftValue == null && rightValue == null) {
        return left.index - right.index;
      }

      return leftValue == null ? 1 : -1;
    }

    return leftValue === rightValue ? left.index - right.index : (leftValue - rightValue) * sign;
  });

  return decorated.map(({ value }) => value);
}
