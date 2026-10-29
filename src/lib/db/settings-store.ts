import { db } from './client';
import { appSettings } from './schema';
import type { AppSettings, CollectionView, RatingSystem } from './types';

const SETTINGS_ID = 1;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  ratingSystem: 'decimal',
  libraryView: 'list',
  exploreView: 'card',
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

function normalizeSettings(input: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    ratingSystem: normalizeRatingSystem(input?.ratingSystem),
    libraryView: normalizeCollectionView(input?.libraryView, DEFAULT_APP_SETTINGS.libraryView),
    exploreView: normalizeCollectionView(input?.exploreView, DEFAULT_APP_SETTINGS.exploreView),
  };
}

export async function getAppSettings(): Promise<AppSettings> {
  const [row] = await db.select().from(appSettings).limit(1);
  if (!row) {
    return saveAppSettings(DEFAULT_APP_SETTINGS);
  }

  return normalizeSettings(row);
}

export async function saveAppSettings(input: AppSettings): Promise<AppSettings> {
  const nextSettings = normalizeSettings(input);

  await db
    .insert(appSettings)
    .values({
      id: SETTINGS_ID,
      ratingSystem: nextSettings.ratingSystem,
      libraryView: nextSettings.libraryView,
      exploreView: nextSettings.exploreView,
    })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: {
        ratingSystem: nextSettings.ratingSystem,
        libraryView: nextSettings.libraryView,
        exploreView: nextSettings.exploreView,
      },
    });

  return nextSettings;
}
