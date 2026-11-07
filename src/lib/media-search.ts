import {
  COMIC_ORIGINS,
  ITEM_STATUSES,
  MEDIA_TYPES,
  RELEASE_STATUSES,
  type ComicOrigin,
  type ItemStatus,
  type MediaType,
  type ReleaseStatus,
} from '@/lib/db/types';
import {
  COMIC_ORIGIN_LABELS,
  MEDIA_TYPE_LABELS,
  RELEASE_STATUS_LABELS,
  STATUS_LABELS,
} from '@/lib/status-labels';

export type ComicFilterValue = `comic:${ComicOrigin}`;
export type MediaFilterValue = MediaType | ComicFilterValue;
export type MediaBrowseFilter = MediaFilterValue[];

export function comicFilterValue(origin: ComicOrigin): ComicFilterValue {
  return `comic:${origin}`;
}

export function getMediaFilterOptions(): {
  value: MediaFilterValue;
  label: string;
}[] {
  const options: { value: MediaFilterValue; label: string }[] = [];

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

export const DEFAULT_MEDIA_FILTER: MediaBrowseFilter = getMediaFilterOptions().map(
  (option) => option.value,
);

export function isMediaFilterActive(filter: MediaBrowseFilter): boolean {
  return DEFAULT_MEDIA_FILTER.some((value) => !filter.includes(value));
}

export type StatusFilterValue = ItemStatus | 'none';

export const DEFAULT_STATUS_FILTER: StatusFilterValue[] = [...ITEM_STATUSES, 'none'];

export function getStatusFilterOptions(includeNotInLibrary: boolean): {
  value: StatusFilterValue;
  label: string;
}[] {
  const options: { value: StatusFilterValue; label: string }[] = ITEM_STATUSES.map((status) => ({
    value: status,
    label: STATUS_LABELS[status],
  }));

  if (includeNotInLibrary) {
    options.push({ value: 'none', label: 'Not in Library' });
  }

  return options;
}

export function toggleStatusFilter(
  filter: StatusFilterValue[],
  value: StatusFilterValue,
): StatusFilterValue[] {
  return filter.includes(value) ? filter.filter((entry) => entry !== value) : [...filter, value];
}

export function isStatusFilterActive(
  filter: StatusFilterValue[],
  includeNotInLibrary = true,
): boolean {
  return getStatusFilterOptions(includeNotInLibrary).some((option) => !filter.includes(option.value));
}

export function matchesStatusFilter(
  status: ItemStatus | null | undefined,
  filter: StatusFilterValue[],
): boolean {
  return filter.includes(status ?? 'none');
}

export const DEFAULT_RELEASE_FILTER: ReleaseStatus[] = [...RELEASE_STATUSES];

export const RELEASE_FILTER_OPTIONS: { value: ReleaseStatus; label: string }[] = RELEASE_STATUSES.map(
  (status) => ({ value: status, label: RELEASE_STATUS_LABELS[status] }),
);

export function toggleReleaseFilter(filter: ReleaseStatus[], value: ReleaseStatus): ReleaseStatus[] {
  return filter.includes(value) ? filter.filter((entry) => entry !== value) : [...filter, value];
}

export function isReleaseFilterActive(filter: ReleaseStatus[]): boolean {
  return DEFAULT_RELEASE_FILTER.some((value) => !filter.includes(value));
}

export function matchesReleaseFilter(
  status: ReleaseStatus | null | undefined,
  filter: ReleaseStatus[],
): boolean {
  if (!status) {
    return !isReleaseFilterActive(filter);
  }

  return filter.includes(status);
}

export function parseGenres(genres: string | null | undefined): string[] {
  return (genres ?? '')
    .split(',')
    .map((genre) => genre.trim())
    .filter(Boolean);
}

export function collectGenres(items: Array<{ genres?: string | null }>): string[] {
  const unique = new Map<string, string>();

  for (const item of items) {
    for (const genre of parseGenres(item.genres)) {
      const key = genre.toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, genre);
      }
    }
  }

  return [...unique.values()].sort((left, right) => left.localeCompare(right));
}

export function toggleGenreFilter(filter: string[], genre: string): string[] {
  const key = genre.toLowerCase();
  return filter.includes(key) ? filter.filter((entry) => entry !== key) : [...filter, key];
}

export function matchesGenreFilter(genres: string | null | undefined, filter: string[]): boolean {
  if (filter.length === 0) {
    return true;
  }

  return parseGenres(genres).some((genre) => filter.includes(genre.toLowerCase()));
}

export const DATE_OPERATORS = ['=', '≠', '≤', '<', '≥', '>'] as const;

export type DateOperator = (typeof DATE_OPERATORS)[number];

export type DateRule = {
  id: string;
  operator: DateOperator;
  year: number;
  month: number | null;
  day: number | null;
};

let nextDateRuleId = 0;

export function createDateRule(operator: DateOperator = '='): DateRule {
  nextDateRuleId += 1;
  return {
    id: `date-${nextDateRuleId}`,
    operator,
    year: new Date().getFullYear(),
    month: null,
    day: null,
  };
}

function dateParts(date: string | null | undefined): number[] | null {
  const match = date?.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!match) {
    return null;
  }

  return [match[1], match[2], match[3]].filter(Boolean).map(Number);
}

export function releaseDateOf(item: {
  releaseDate?: string | null;
  season?: string | null;
}): string | null {
  if (item.releaseDate) {
    return item.releaseDate;
  }

  return item.season?.match(/\b(\d{4})\b/)?.[1] ?? null;
}

function rulePasses(itemParts: number[], rule: DateRule): boolean {
  const ruleParts = [rule.year, rule.month, rule.month == null ? null : rule.day].filter(
    (part): part is number => part != null,
  );
  const depth = Math.min(itemParts.length, ruleParts.length);
  let compare = 0;

  for (let index = 0; index < depth && compare === 0; index += 1) {
    compare = itemParts[index] - ruleParts[index];
  }

  switch (rule.operator) {
    case '=':
      return compare === 0;
    case '≠':
      return compare !== 0;
    case '≤':
      return compare <= 0;
    case '<':
      return compare < 0;
    case '≥':
      return compare >= 0;
    case '>':
      return compare > 0;
  }
}

export function matchesDateRules(date: string | null | undefined, rules: DateRule[]): boolean {
  if (rules.length === 0) {
    return true;
  }

  const parts = dateParts(date);
  if (!parts) {
    return false;
  }

  return rules.every((rule) => rulePasses(parts, rule));
}

export const FEED_FILTERS = ['your', 'following'] as const;

export type FeedFilterValue = (typeof FEED_FILTERS)[number];
export type FeedFilterOption = FeedFilterValue | 'all';
export type FeedFilter = FeedFilterValue[];

export const FEED_FILTER_OPTIONS: { value: FeedFilterOption; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'your', label: 'Your Activity' },
  { value: 'following', label: 'Following' },
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
  if (item.mediaType !== 'comic') {
    return filter.includes(item.mediaType);
  }

  return filter.includes(comicFilterValue(item.mangaOrigin ?? 'american'));
}

export function toggleMediaFilter(
  filter: MediaBrowseFilter,
  option: MediaFilterValue,
): MediaBrowseFilter {
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

// Which server-side feed query a filter selection maps to. Picking both is the
// same as All.
export function feedScopeFor(filter: FeedFilter): 'all' | 'your' | 'following' {
  if (filter.length === 1) {
    return filter[0]!;
  }

  return 'all';
}

export function matchesFeedSearch(
  item: { title?: string | null; body?: string | null; mediaTitle?: string | null },
  query: string,
  catalogTitle?: string | null,
): boolean {
  return matchesAnySearchText(query, catalogTitle, item.mediaTitle, item.body, item.title);
}
