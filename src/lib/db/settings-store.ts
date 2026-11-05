import { eq } from 'drizzle-orm';

import { getActiveUserId } from './active-user';
import { notifyLocalWrite } from './changes';
import { db } from './client';
import { appSettings } from './schema';
import { ITEM_STATUSES, type AppSettings, type CollectionView, type ColorScheme, type ItemStatus, type RatingSystem } from './types';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  ratingSystem: 'decimal',
  libraryView: 'list',
  exploreView: 'card',
  colorScheme: 'dark',
  libraryExpanded: ['in_progress'],
};

function normalizeRatingSystem(value: string | null | undefined): RatingSystem {
  return value === 'whole' ? 'whole' : 'decimal';
}

function normalizeCollectionView(
  value: string | null | undefined,
  fallback: CollectionView,
): CollectionView {
  return value === 'list' || value === 'card' ? value : fallback;
}

function normalizeColorScheme(value: string | null | undefined): ColorScheme {
  return value === 'light' ? 'light' : 'dark';
}

function normalizeLibraryExpanded(value: string | ItemStatus[] | null | undefined): ItemStatus[] {
  if (value == null) {
    return DEFAULT_APP_SETTINGS.libraryExpanded;
  }

  const selected = new Set(typeof value === 'string' ? value.split(',') : value);
  return ITEM_STATUSES.filter((status) => selected.has(status));
}

type StoredSettings = Omit<Partial<AppSettings>, 'libraryExpanded'> & {
  libraryExpanded?: string | ItemStatus[] | null;
};

function normalizeSettings(input: StoredSettings | null | undefined): AppSettings {
  return {
    ratingSystem: normalizeRatingSystem(input?.ratingSystem),
    libraryView: normalizeCollectionView(input?.libraryView, DEFAULT_APP_SETTINGS.libraryView),
    exploreView: normalizeCollectionView(input?.exploreView, DEFAULT_APP_SETTINGS.exploreView),
    colorScheme: normalizeColorScheme(input?.colorScheme),
    libraryExpanded: normalizeLibraryExpanded(input?.libraryExpanded),
  };
}

export async function getAppSettings(): Promise<AppSettings> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.userId, getActiveUserId()))
    .limit(1);
  if (!row) {
    // Dated at the epoch so a real settings row from another device always wins.
    return writeAppSettings(DEFAULT_APP_SETTINGS, new Date(0).toISOString());
  }

  return normalizeSettings(row);
}

export async function saveAppSettings(input: AppSettings): Promise<AppSettings> {
  const saved = await writeAppSettings(input, new Date().toISOString());
  notifyLocalWrite();
  return saved;
}

async function writeAppSettings(input: AppSettings, updatedAt: string): Promise<AppSettings> {
  const nextSettings = normalizeSettings(input);

  await db
    .insert(appSettings)
    .values({
      userId: getActiveUserId(),
      ratingSystem: nextSettings.ratingSystem,
      libraryView: nextSettings.libraryView,
      exploreView: nextSettings.exploreView,
      colorScheme: nextSettings.colorScheme,
      libraryExpanded: nextSettings.libraryExpanded.join(','),
      updatedAt,
    })
    .onConflictDoUpdate({
      target: appSettings.userId,
      set: {
        ratingSystem: nextSettings.ratingSystem,
        libraryView: nextSettings.libraryView,
        exploreView: nextSettings.exploreView,
        colorScheme: nextSettings.colorScheme,
        libraryExpanded: nextSettings.libraryExpanded.join(','),
        updatedAt,
      },
    });

  return nextSettings;
}
