import { buildCatalogEntries, CATALOG_REMOTE_SOURCE_COUNT } from '@/lib/catalog-sources';

import { SAMPLE_CATALOG } from './catalog-data';
import { getCatalogItems, insertCatalogItems } from './catalog-store';
import { db, sqlite } from './client';
import { reportSeedProgress, type OnSeedProgress } from './progress';
import { catalog } from './schema';
import type { CatalogItem } from './types';

function catalogNeedsHydration(existing: CatalogItem[]): boolean {
  if (existing.length === 0) {
    return true;
  }

  return existing.every((item) => !item.coverImageUrl);
}

async function clearCatalog(): Promise<void> {
  await db.delete(catalog);

  try {
    sqlite.execSync("DELETE FROM sqlite_sequence WHERE name = 'catalog'");
  } catch {
    // sqlite_sequence is created after the first insert; ignore if missing.
  }
}

let catalogWrite: Promise<unknown> = Promise.resolve();

function runCatalogWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = catalogWrite.then(fn, fn);
  catalogWrite = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function replaceCatalogFromSources(
  onProgress?: OnSeedProgress,
  extraSteps = 0,
): Promise<CatalogItem[]> {
  const saveSteps = 1;
  const total = CATALOG_REMOTE_SOURCE_COUNT + saveSteps + extraSteps;
  const entries = await buildCatalogEntries(onProgress, saveSteps + extraSteps);
  const next = entries.length > 0 ? entries : SAMPLE_CATALOG;
  reportSeedProgress(onProgress, 'Saving catalog…', CATALOG_REMOTE_SOURCE_COUNT, total);
  await clearCatalog();
  const saved = await insertCatalogItems(next);
  reportSeedProgress(onProgress, 'Catalog saved', CATALOG_REMOTE_SOURCE_COUNT + saveSteps, total);
  return saved;
}

export async function seedCatalog(): Promise<CatalogItem[]> {
  return runCatalogWrite(() => replaceCatalogFromSources());
}

export async function seedCatalogIfEmpty(onProgress?: OnSeedProgress): Promise<CatalogItem[]> {
  return runCatalogWrite(async () => {
    const existing = await getCatalogItems();
    if (!catalogNeedsHydration(existing)) {
      return existing;
    }

    return replaceCatalogFromSources(onProgress);
  });
}

export async function resetAndSeedCatalog(
  onProgress?: OnSeedProgress,
  extraSteps = 0,
): Promise<CatalogItem[]> {
  return runCatalogWrite(() => replaceCatalogFromSources(onProgress, extraSteps));
}
