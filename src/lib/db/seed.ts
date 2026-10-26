import { CATALOG_REMOTE_SOURCE_COUNT } from '@/lib/catalog-sources';

import { seedCatalogIfEmpty } from './catalog-seed';
import { db, sqlite } from './client';
import { reportSeedProgress, type OnSeedProgress } from './progress';
import { getCatalogItems } from './catalog-store';
import { getItems } from './items';
import { items } from './schema';
import {
  isChapteredMediaType,
  isPagedMediaType,
  isShowMediaType,
  type CatalogItem,
  type ComicOrigin,
  type Item,
  type ItemStatus,
  type MediaType,
  type NewItemInput,
} from './types';

type SamplePlan = {
  mediaType: MediaType;
  origin?: ComicOrigin;
  status: ItemStatus;
  rating: number | null;
  notes: string | null;
  progressRatio: number | null;
  daysAgo: number;
};

const SAMPLE_PLANS: SamplePlan[] = [
  {
    mediaType: 'book',
    status: 'completed',
    rating: 9,
    notes: 'Comfort reread. Still holds up.',
    progressRatio: 1,
    daysAgo: 340,
  },
  {
    mediaType: 'book',
    status: 'in_progress',
    rating: 8.2,
    notes: 'Halfway through and already plotting a reread.',
    progressRatio: 0.5,
    daysAgo: 48,
  },
  {
    mediaType: 'movie',
    status: 'completed',
    rating: 10,
    notes: null,
    progressRatio: 1,
    daysAgo: 410,
  },
  {
    mediaType: 'movie',
    status: 'planning',
    rating: null,
    notes: 'Saving this for a weekend watch.',
    progressRatio: null,
    daysAgo: 22,
  },
  {
    mediaType: 'tv',
    status: 'in_progress',
    rating: 8.4,
    notes: 'On a mid-season stretch.',
    progressRatio: 0.55,
    daysAgo: 120,
  },
  {
    mediaType: 'tv',
    status: 'planning',
    rating: null,
    notes: null,
    progressRatio: null,
    daysAgo: 16,
  },
  {
    mediaType: 'anime',
    status: 'in_progress',
    rating: 9.1,
    notes: 'Caught up. Waiting on the next drop.',
    progressRatio: 0.7,
    daysAgo: 200,
  },
  {
    mediaType: 'anime',
    status: 'completed',
    rating: 8.7,
    notes: null,
    progressRatio: 1,
    daysAgo: 520,
  },
  {
    mediaType: 'comic',
    origin: 'japanese',
    status: 'completed',
    rating: 10,
    notes: 'Finished the whole run.',
    progressRatio: 1,
    daysAgo: 600,
  },
  {
    mediaType: 'comic',
    origin: 'south_korean',
    status: 'in_progress',
    rating: 8.6,
    notes: 'Binging a few chapters at a time.',
    progressRatio: 0.4,
    daysAgo: 70,
  },
  {
    mediaType: 'comic',
    origin: 'american',
    status: 'planning',
    rating: null,
    notes: 'Picked this up from Explore.',
    progressRatio: null,
    daysAgo: 9,
  },
  {
    mediaType: 'game',
    status: 'on_hold',
    rating: null,
    notes: 'One more run later. Need a break.',
    progressRatio: null,
    daysAgo: 280,
  },
  {
    mediaType: 'game',
    status: 'planning',
    rating: null,
    notes: 'Next after the current backlog.',
    progressRatio: null,
    daysAgo: 35,
  },
  {
    mediaType: 'tv',
    status: 'dropped',
    rating: 5.5,
    notes: 'Lost the thread after a few episodes.',
    progressRatio: 0.15,
    daysAgo: 90,
  },
  {
    mediaType: 'book',
    status: 'revisiting',
    rating: 8.8,
    notes: 'Back for another pass.',
    progressRatio: 0.25,
    daysAgo: 12,
  },
];

function daysAgoIso(daysAgo: number, finished: boolean): { dateAdded: string; finishDate: string | null } {
  const added = new Date();
  added.setUTCDate(added.getUTCDate() - daysAgo);
  const dateAdded = added.toISOString();

  if (!finished) {
    return { dateAdded, finishDate: null };
  }

  const finishedAt = new Date(added);
  finishedAt.setUTCDate(finishedAt.getUTCDate() + Math.min(14, Math.max(1, Math.floor(daysAgo / 8))));
  return { dateAdded, finishDate: finishedAt.toISOString() };
}

function scaledTotal(total: number | null, ratio: number | null, completed: boolean): number | null {
  if (total == null) {
    return null;
  }

  if (completed) {
    return total;
  }

  if (ratio == null) {
    return null;
  }

  return Math.max(1, Math.min(total, Math.round(total * ratio)));
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
  const matches = catalog.filter((item) => !used.has(item.id) && catalogMatches(item, mediaType, origin));
  return matches.find((item) => item.coverImageUrl) ?? matches[0];
}

function toLibraryItem(catalogItem: CatalogItem, plan: SamplePlan): NewItemInput & { dateAdded: string } {
  const completed = plan.status === 'completed';
  const { dateAdded, finishDate } = daysAgoIso(plan.daysAgo, completed);
  const origin = catalogItem.mangaOrigin ?? plan.origin ?? null;

  return {
    title: catalogItem.title,
    mediaType: catalogItem.mediaType,
    status: plan.status,
    rating: plan.rating,
    notes: plan.notes,
    coverImageUrl: catalogItem.coverImageUrl,
    releaseStatus: catalogItem.releaseStatus ?? null,
    mangaOrigin: catalogItem.mediaType === 'comic' ? origin ?? 'american' : origin,
    totalEpisodes: catalogItem.totalEpisodes ?? null,
    totalPages: catalogItem.totalPages ?? null,
    totalChapters: catalogItem.totalChapters ?? null,
    currentEpisodes: isShowMediaType(catalogItem.mediaType)
      ? scaledTotal(catalogItem.totalEpisodes, plan.progressRatio, completed)
      : null,
    currentPages: isPagedMediaType(catalogItem.mediaType, origin)
      ? scaledTotal(catalogItem.totalPages, plan.progressRatio, completed)
      : null,
    currentChapters: isChapteredMediaType(catalogItem.mediaType, origin)
      ? scaledTotal(catalogItem.totalChapters, plan.progressRatio, completed)
      : null,
    dateAdded,
    finishDate,
  };
}

export async function sampleItemsFromCatalog(): Promise<Array<NewItemInput & { dateAdded: string }>> {
  const catalog = await getCatalogItems();
  const used = new Set<number>();
  const seeded: Array<NewItemInput & { dateAdded: string }> = [];

  for (const plan of SAMPLE_PLANS) {
    const catalogItem = pickCatalogItem(catalog, used, plan.mediaType, plan.origin);
    if (!catalogItem) {
      continue;
    }

    used.add(catalogItem.id);
    seeded.push(toLibraryItem(catalogItem, plan));
  }

  return seeded;
}

export async function seedItems(onProgress?: OnSeedProgress): Promise<Item[]> {
  const remainingSteps = 1;
  let hydratedCatalog = false;

  reportSeedProgress(onProgress, 'Checking catalog…', 0, remainingSteps);
  await seedCatalogIfEmpty((progress) => {
    hydratedCatalog = true;
    onProgress?.({
      ...progress,
      total: progress.total + remainingSteps,
    });
  });

  const offset = hydratedCatalog ? CATALOG_REMOTE_SOURCE_COUNT + 1 : 0;
  const total = offset + remainingSteps;
  reportSeedProgress(onProgress, 'Seeding library…', offset, total);
  const sampleItems = await sampleItemsFromCatalog();
  if (sampleItems.length === 0) {
    reportSeedProgress(onProgress, 'Library seeded', total, total);
    return [];
  }

  const seeded = await db.insert(items).values(sampleItems).returning();
  reportSeedProgress(onProgress, 'Library seeded', total, total);
  return seeded;
}

export async function seedIfEmpty(): Promise<Item[]> {
  const existing = await getItems();
  if (existing.length > 0) {
    return existing;
  }

  return seedItems();
}

export async function resetAndSeed(onProgress?: OnSeedProgress): Promise<Item[]> {
  await db.delete(items);

  try {
    sqlite.execSync("DELETE FROM sqlite_sequence WHERE name = 'items'");
  } catch {
    // sqlite_sequence is created after the first insert; ignore if missing.
  }

  return seedItems(onProgress);
}
