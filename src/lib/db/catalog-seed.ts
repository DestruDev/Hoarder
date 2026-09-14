import { db, sqlite } from './client';
import { SAMPLE_CATALOG } from './catalog-data';
import { getCatalogItems } from './catalog-store';
import { catalog } from './schema';
import type { CatalogItem } from './types';

export async function seedCatalog(): Promise<CatalogItem[]> {
  return db.insert(catalog).values(SAMPLE_CATALOG).returning();
}

export async function seedCatalogIfEmpty(): Promise<CatalogItem[]> {
  const existing = await getCatalogItems();
  if (existing.length > 0) {
    return existing;
  }

  return seedCatalog();
}

export async function resetAndSeedCatalog(): Promise<CatalogItem[]> {
  await db.delete(catalog);

  try {
    sqlite.execSync("DELETE FROM sqlite_sequence WHERE name = 'catalog'");
  } catch {
    // sqlite_sequence is created after the first insert; ignore if missing.
  }

  return seedCatalog();
}
