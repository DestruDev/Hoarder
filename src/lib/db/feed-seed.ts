import { lookupItunesMovieCover } from '@/lib/catalog-sources/itunes';
import { mapInBatches } from '@/lib/catalog-sources/http';

import { seedCatalogIfEmpty } from './catalog-seed';
import { getCatalogItems, updateCatalogCover } from './catalog-store';
import { sqlite } from './client';
import { clearFeedNotifications, getFeedNotifications, insertFeedNotifications } from './feed-store';
import {
  isChapteredMediaType,
  type CatalogItem,
  type ComicOrigin,
  type FeedKind,
  type FeedNotification,
  type MediaType,
  type NewFeedNotification,
} from './types';

type FeedPlan = {
  mediaType: MediaType;
  origin?: ComicOrigin;
  kind: FeedKind;
  hoursAgo: number;
  friendName?: string;
  title: string;
  body: (item: CatalogItem) => string;
};

const FRIENDS = ['Alex', 'Sam', 'Jordan', 'Riley'];

const FEED_PLANS: FeedPlan[] = [
  {
    mediaType: 'anime',
    kind: 'media',
    hoursAgo: 0.4,
    title: 'New episode available',
    body: (item) => `${item.title} — Episode ${item.totalEpisodes ?? 1} is out.`,
  },
  {
    mediaType: 'comic',
    origin: 'japanese',
    kind: 'media',
    hoursAgo: 2,
    title: 'New chapter available',
    body: (item) => `${item.title} — Chapter ${item.totalChapters ?? 1} is out.`,
  },
  {
    mediaType: 'tv',
    kind: 'media',
    hoursAgo: 5,
    title: 'New episode available',
    body: (item) => `${item.title} — Episode ${item.totalEpisodes ?? 1} is out.`,
  },
  {
    mediaType: 'movie',
    kind: 'media',
    hoursAgo: 8,
    title: 'Release reminder',
    body: (item) => `${item.title} has a new trailer.`,
  },
  {
    mediaType: 'game',
    kind: 'media',
    hoursAgo: 26,
    title: 'Game update',
    body: (item) => `${item.title} got a new update.`,
  },
  {
    mediaType: 'book',
    kind: 'media',
    hoursAgo: 72,
    title: 'Book update',
    body: (item) => `${item.title} has a related release date.`,
  },
  {
    mediaType: 'comic',
    origin: 'south_korean',
    kind: 'media',
    hoursAgo: 14,
    title: 'New chapter available',
    body: (item) => `${item.title} — Chapter ${item.totalChapters ?? 1} is out.`,
  },
  {
    mediaType: 'comic',
    origin: 'american',
    kind: 'media',
    hoursAgo: 30,
    title: 'New issue available',
    body: (item) => `${item.title} has a new issue.`,
  },
  {
    mediaType: 'anime',
    kind: 'friend',
    hoursAgo: 6,
    friendName: FRIENDS[0],
    title: 'Friend activity',
    body: (item) => `${FRIENDS[0]} completed ${item.title}.`,
  },
  {
    mediaType: 'comic',
    origin: 'japanese',
    kind: 'friend',
    hoursAgo: 48,
    friendName: FRIENDS[1],
    title: 'Friend activity',
    body: (item) => `${FRIENDS[1]} started ${item.title}.`,
  },
  {
    mediaType: 'game',
    kind: 'friend',
    hoursAgo: 18,
    friendName: FRIENDS[2],
    title: 'Friend activity',
    body: (item) => `${FRIENDS[2]} added ${item.title} to their library.`,
  },
  {
    mediaType: 'tv',
    kind: 'friend',
    hoursAgo: 3,
    friendName: FRIENDS[3],
    title: 'Friend activity',
    body: (item) => `${FRIENDS[3]} is watching ${item.title}.`,
  },
];

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function catalogMatches(item: CatalogItem, mediaType: MediaType, origin?: ComicOrigin): boolean {
  if (item.mediaType !== mediaType) {
    return false;
  }

  if (!origin) {
    return true;
  }

  return (item.mangaOrigin ?? 'american') === origin;
}

function pickCatalogItem(
  catalog: CatalogItem[],
  used: Set<number>,
  mediaType: MediaType,
  origin?: ComicOrigin,
): CatalogItem | undefined {
  return catalog.find(
    (item) =>
      !used.has(item.id) && Boolean(item.coverImageUrl) && catalogMatches(item, mediaType, origin),
  );
}

async function fillMissingMovieCovers(): Promise<void> {
  const movies = (await getCatalogItems('movie')).filter((item) => !item.coverImageUrl);
  if (movies.length === 0) {
    return;
  }

  await mapInBatches(movies, 3, async (movie) => {
    const coverImageUrl = await lookupItunesMovieCover(movie.title);
    if (!coverImageUrl) {
      return null;
    }

    await updateCatalogCover(movie.id, coverImageUrl);
    return coverImageUrl;
  });
}

function toFeedNotification(item: CatalogItem, plan: FeedPlan): NewFeedNotification {
  const usesChapters = plan.title === 'New chapter available';
  const title =
    usesChapters && !isChapteredMediaType(item.mediaType, item.mangaOrigin)
      ? 'New issue available'
      : plan.title;
  const body =
    usesChapters && !isChapteredMediaType(item.mediaType, item.mangaOrigin)
      ? `${item.title} has a new issue.`
      : plan.body(item);

  return {
    title,
    body,
    mediaTitle: item.title,
    mediaType: item.mediaType,
    kind: plan.kind,
    occurredAt: hoursAgoIso(plan.hoursAgo),
    catalogId: item.id,
  };
}

export async function sampleFeedFromCatalog(): Promise<NewFeedNotification[]> {
  const catalog = await getCatalogItems();
  const used = new Set<number>();
  const seeded: NewFeedNotification[] = [];

  for (const plan of FEED_PLANS) {
    const catalogItem = pickCatalogItem(catalog, used, plan.mediaType, plan.origin);
    if (!catalogItem) {
      continue;
    }

    used.add(catalogItem.id);
    seeded.push(toFeedNotification(catalogItem, plan));
  }

  return seeded;
}

export async function seedFeedNotifications(): Promise<FeedNotification[]> {
  await seedCatalogIfEmpty();
  await fillMissingMovieCovers();
  const entries = await sampleFeedFromCatalog();
  if (entries.length === 0) {
    return [];
  }

  return insertFeedNotifications(entries);
}

export async function seedFeedIfEmpty(): Promise<FeedNotification[]> {
  const existing = await getFeedNotifications();
  if (existing.length === 0) {
    return seedFeedNotifications();
  }

  const catalog = await getCatalogItems();
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const missingCovers = existing.some((item) => !catalogById.get(item.catalogId)?.coverImageUrl);
  if (!missingCovers) {
    return existing;
  }

  return resetAndSeedFeed();
}

export async function resetAndSeedFeed(): Promise<FeedNotification[]> {
  await clearFeedNotifications();

  try {
    sqlite.execSync("DELETE FROM sqlite_sequence WHERE name = 'feed_notifications'");
  } catch {
    // sqlite_sequence is created after the first insert; ignore if missing.
  }

  return seedFeedNotifications();
}
