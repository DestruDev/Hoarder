import { randomUUID } from 'expo-crypto';
import { and, desc, eq, isNull, type SQL } from 'drizzle-orm';

import { getActiveUserId } from './active-user';
import { notifyLocalWrite } from './changes';
import { db } from './client';
import { items } from './schema';
import type { CatalogItem, Item, ItemFilters, ItemStatus, MediaType, NewItemInput } from './types';

// Soft-deleted rows stay in the table until synced, so every read skips them.
function ownedItems(): SQL | undefined {
  return and(eq(items.userId, getActiveUserId()), isNull(items.deletedAt));
}

function ownedItem(id: number): SQL | undefined {
  return and(eq(items.id, id), ownedItems());
}

export async function getItems(filters: ItemFilters = {}): Promise<Item[]> {
  const conditions: (SQL | undefined)[] = [ownedItems()];

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
        ownedItems(),
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
      syncId: randomUUID(),
      dateAdded: input.dateAdded ?? now,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    throw new Error('Failed to create item');
  }

  notifyLocalWrite();
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
  notifyLocalWrite();
  return updated;
}

export async function deleteItem(id: number): Promise<boolean> {
  const now = new Date().toISOString();
  const deleted = await db
    .update(items)
    .set({ deletedAt: now, updatedAt: now })
    .where(ownedItem(id))
    .returning({ id: items.id });
  notifyLocalWrite();
  return deleted.length > 0;
}
