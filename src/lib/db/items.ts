import { and, desc, eq, type SQL } from 'drizzle-orm';

import { getActiveUserId } from './active-user';
import { db } from './client';
import { items } from './schema';
import type { CatalogItem, Item, ItemFilters, ItemStatus, MediaType, NewItemInput } from './types';

function ownedItem(id: number): SQL | undefined {
  return and(eq(items.id, id), eq(items.userId, getActiveUserId()));
}

export async function getItems(filters: ItemFilters = {}): Promise<Item[]> {
  const conditions: SQL[] = [eq(items.userId, getActiveUserId())];

  if (filters.mediaType) {
    conditions.push(eq(items.mediaType, filters.mediaType));
  }

  if (filters.status) {
    conditions.push(eq(items.status, filters.status));
  }

  return db
    .select()
    .from(items)
    .where(and(...conditions))
    .orderBy(desc(items.dateAdded));
}

export async function getItemById(id: number): Promise<Item | undefined> {
  const [item] = await db.select().from(items).where(ownedItem(id)).limit(1);
  return item;
}

export async function findItemByTitleAndType(
  title: string,
  mediaType: MediaType,
): Promise<Item | undefined> {
  const [item] = await db
    .select()
    .from(items)
    .where(
      and(
        eq(items.userId, getActiveUserId()),
        eq(items.title, title),
        eq(items.mediaType, mediaType),
      ),
    )
    .limit(1);

  return item;
}

export async function addCatalogItemToLibrary(
  catalogItem: Pick<CatalogItem, 'title' | 'mediaType' | 'coverImageUrl' | 'releaseStatus' | 'mangaOrigin' | 'totalEpisodes' | 'totalPages' | 'totalChapters'>,
  status: ItemStatus,
): Promise<Item> {
  const existing = await findItemByTitleAndType(catalogItem.title, catalogItem.mediaType);
  if (existing) {
    return (await updateItem(existing.id, { status })) ?? existing;
  }

  return createItem({
    title: catalogItem.title,
    mediaType: catalogItem.mediaType,
    status,
    rating: null,
    notes: null,
    coverImageUrl: catalogItem.coverImageUrl,
    releaseStatus: catalogItem.releaseStatus ?? null,
    mangaOrigin: catalogItem.mediaType === 'comic' ? catalogItem.mangaOrigin ?? 'american' : catalogItem.mangaOrigin ?? null,
    totalEpisodes: catalogItem.totalEpisodes ?? null,
    totalPages: catalogItem.totalPages ?? null,
    totalChapters: catalogItem.totalChapters ?? null,
    currentEpisodes: null,
    currentPages: null,
    currentChapters: null,
    finishDate: null,
  });
}

export async function createItem(input: NewItemInput): Promise<Item> {
  const now = new Date().toISOString();
  const [created] = await db
    .insert(items)
    .values({
      ...input,
      userId: getActiveUserId(),
      dateAdded: input.dateAdded ?? now,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    throw new Error('Failed to create item');
  }

  return created;
}

export async function updateItem(
  id: number,
  input: Partial<NewItemInput>,
): Promise<Item | undefined> {
  const [updated] = await db
    .update(items)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(ownedItem(id))
    .returning();
  return updated;
}

export async function deleteItem(id: number): Promise<boolean> {
  const deleted = await db.delete(items).where(ownedItem(id)).returning({ id: items.id });
  return deleted.length > 0;
}
