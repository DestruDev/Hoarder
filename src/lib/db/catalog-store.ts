import { and, eq, inArray, sql } from 'drizzle-orm';

import { db } from './client';
import { catalog } from './schema';
import type { CatalogItem, MediaType, NewCatalogItem } from './types';

function catalogKey(item: Pick<CatalogItem, 'title' | 'mediaType'>): string {
  return `${item.mediaType}:${item.title.trim().toLowerCase()}`;
}

function sourceKey(item: { source?: string | null; externalId?: string | null }): string | null {
  return item.source && item.externalId ? `${item.source}:${item.externalId}` : null;
}

// Keeps a row featured once it is, and fills in a source id the row was missing
// unless another row already holds it (the pair is unique).
function mergedIdentity(found: CatalogItem, entry: NewCatalogItem, idTaken = false) {
  const adoptId = !found.externalId && sourceKey(entry) != null && !idTaken;
  return {
    featured: found.featured || entry.featured === true,
    source: adoptId ? entry.source : found.source,
    externalId: adoptId ? entry.externalId : found.externalId,
  };
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

let cachedCatalog: CatalogItem[] | null = null;

export function peekCatalogItems(): CatalogItem[] | null {
  return cachedCatalog;
}

export async function getCatalogItems(mediaType?: MediaType): Promise<CatalogItem[]> {
  if (mediaType) {
    return db.select().from(catalog).where(eq(catalog.mediaType, mediaType));
  }

  const rows = await db.select().from(catalog);
  cachedCatalog = rows;
  return rows;
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
  const takenIds = new Set(existing.map(sourceKey).filter((key) => key != null));
  const toInsert: NewCatalogItem[] = [];

  for (const entry of entries) {
    const found = byKey.get(catalogKey(entry));
    const entryId = sourceKey(entry);
    if (!found) {
      toInsert.push(entryId && takenIds.has(entryId) ? { ...entry, source: null, externalId: null } : entry);
      if (entryId) {
        takenIds.add(entryId);
      }
      continue;
    }

    const identity = mergedIdentity(found, entry, entryId != null && takenIds.has(entryId));
    if (identity.externalId !== found.externalId && entryId) {
      takenIds.add(entryId);
    }

    const next = {
      ...identity,
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
      releaseDate: entry.releaseDate ?? found.releaseDate,
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

async function findCatalogMatch(entry: NewCatalogItem): Promise<CatalogItem | undefined> {
  if (entry.source && entry.externalId) {
    const [byId] = await db
      .select()
      .from(catalog)
      .where(and(eq(catalog.source, entry.source), eq(catalog.externalId, entry.externalId)))
      .limit(1);
    if (byId) {
      return byId;
    }
  }

  const [byTitle] = await db
    .select()
    .from(catalog)
    .where(
      and(
        eq(catalog.mediaType, entry.mediaType),
        sql`lower(trim(${catalog.title})) = ${entry.title.trim().toLowerCase()}`,
      ),
    )
    .limit(1);
  return byTitle;
}

// Saves one title (from search or Related) and returns its row. Looks it up by source
// id, then by title, so it never scans the whole table.
export async function saveCatalogEntry(entry: NewCatalogItem): Promise<CatalogItem> {
  const found = await findCatalogMatch(entry);
  if (!found) {
    const [inserted] = await db.insert(catalog).values(entry).returning();
    return inserted;
  }

  const next = {
    ...mergedIdentity(found, entry),
    coverImageUrl: found.coverImageUrl ?? entry.coverImageUrl,
    releaseStatus: entry.releaseStatus ?? found.releaseStatus,
    mangaOrigin: found.mangaOrigin ?? entry.mangaOrigin,
    totalEpisodes: entry.totalEpisodes ?? found.totalEpisodes,
    totalPages: entry.totalPages ?? found.totalPages,
    totalChapters: entry.totalChapters ?? found.totalChapters,
    globalRating: entry.globalRating ?? found.globalRating,
    season: found.season ?? entry.season,
    genres: found.genres ?? entry.genres,
    creator: found.creator ?? entry.creator,
    synopsis: found.synopsis ?? entry.synopsis,
    releaseDate: found.releaseDate ?? entry.releaseDate,
  };

  const [updated] = await db.update(catalog).set(next).where(eq(catalog.id, found.id)).returning();
  return updated ?? found;
}
