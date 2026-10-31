import { and, eq, inArray } from 'drizzle-orm';

import { db } from './client';
import { catalog } from './schema';
import type { CatalogItem, MediaType, NewCatalogItem } from './types';

function catalogKey(item: Pick<CatalogItem, 'title' | 'mediaType'>): string {
  return `${item.mediaType}:${item.title.trim().toLowerCase()}`;
}

const INSERT_CHUNK_SIZE = 40;

export async function insertCatalogItems(entries: NewCatalogItem[]): Promise<CatalogItem[]> {
  if (entries.length === 0) {
    return [];
  }

  const saved: CatalogItem[] = [];

  for (let index = 0; index < entries.length; index += INSERT_CHUNK_SIZE) {
    const chunk = entries.slice(index, index + INSERT_CHUNK_SIZE);
    const inserted = await db.insert(catalog).values(chunk).returning();
    saved.push(...inserted);
  }

  return saved;
}

export async function getCatalogItems(mediaType?: MediaType): Promise<CatalogItem[]> {
  if (mediaType) {
    return db.select().from(catalog).where(eq(catalog.mediaType, mediaType));
  }

  return db.select().from(catalog);
}

export async function getCatalogItemById(id: number): Promise<CatalogItem | undefined> {
  const [item] = await db.select().from(catalog).where(eq(catalog.id, id)).limit(1);
  return item;
}

export async function updateCatalogCover(id: number, coverImageUrl: string): Promise<void> {
  await db.update(catalog).set({ coverImageUrl }).where(eq(catalog.id, id));
}

export async function findCatalogItemByTitleAndType(
  title: string,
  mediaType: MediaType,
): Promise<CatalogItem | undefined> {
  const [item] = await db
    .select()
    .from(catalog)
    .where(and(eq(catalog.title, title), eq(catalog.mediaType, mediaType)))
    .limit(1);

  return item;
}

export async function upsertCatalogItems(entries: NewCatalogItem[]): Promise<CatalogItem[]> {
  const existing = await getCatalogItems();
  const byKey = new Map(existing.map((item) => [catalogKey(item), item]));
  const toInsert: NewCatalogItem[] = [];

  for (const entry of entries) {
    const found = byKey.get(catalogKey(entry));
    if (!found) {
      toInsert.push(entry);
      continue;
    }

    const next = {
      coverImageUrl: entry.coverImageUrl ?? found.coverImageUrl,
      releaseStatus: entry.releaseStatus ?? found.releaseStatus,
      mangaOrigin: entry.mangaOrigin ?? found.mangaOrigin,
      totalEpisodes: entry.totalEpisodes ?? found.totalEpisodes,
      totalPages: entry.totalPages ?? found.totalPages,
      totalChapters: entry.totalChapters ?? found.totalChapters,
      globalRating: entry.globalRating ?? found.globalRating,
      season: entry.season ?? found.season,
      genres: entry.genres ?? found.genres,
      creator: entry.creator ?? found.creator,
      synopsis: entry.synopsis ?? found.synopsis,
    };

    const changed = (Object.keys(next) as Array<keyof typeof next>).some(
      (key) => next[key] !== found[key],
    );
    if (!changed) {
      continue;
    }

    await db.update(catalog).set(next).where(eq(catalog.id, found.id));
  }

  await insertCatalogItems(toInsert);
  return getCatalogItems();
}

export async function pruneCoverlessCatalogItems(): Promise<void> {
  const existing = await getCatalogItems();
  const groups = new Map<string, CatalogItem[]>();

  for (const item of existing) {
    const key =
      item.mediaType === 'comic' ? `comic:${item.mangaOrigin ?? 'american'}` : item.mediaType;
    const rows = groups.get(key) ?? [];
    rows.push(item);
    groups.set(key, rows);
  }

  const ids: number[] = [];
  for (const rows of groups.values()) {
    if (!rows.some((row) => row.coverImageUrl)) {
      continue;
    }

    for (const row of rows) {
      if (!row.coverImageUrl) {
        ids.push(row.id);
      }
    }
  }

  if (ids.length === 0) {
    return;
  }

  await db.delete(catalog).where(inArray(catalog.id, ids));
}
