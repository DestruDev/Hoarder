import { buildCatalogEntries } from '@/lib/catalog-sources';

import { SAMPLE_CATALOG } from './catalog-data';
import { getCatalogItems, insertCatalogItems } from './catalog-store';
import { db, sqlite } from './client';
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

async function replaceCatalogFromSources(): Promise<CatalogItem[]> {
  const entries = await buildCatalogEntries();
  const next = entries.length > 0 ? entries : SAMPLE_CATALOG;
  await clearCatalog();
  return insertCatalogItems(next);
}

export async function seedCatalog(): Promise<CatalogItem[]> {
  return runCatalogWrite(replaceCatalogFromSources);
}

export async function seedCatalogIfEmpty(): Promise<CatalogItem[]> {
  return runCatalogWrite(async () => {
    const existing = await getCatalogItems();
    if (!catalogNeedsHydration(existing)) {
      return existing;
    }

    return replaceCatalogFromSources();
  });
}

export async function resetAndSeedCatalog(): Promise<CatalogItem[]> {
  return runCatalogWrite(replaceCatalogFromSources);
}
