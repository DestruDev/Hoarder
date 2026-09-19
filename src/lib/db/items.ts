import { and, desc, eq, type SQL } from 'drizzle-orm';

import { db } from './client';
import { items } from './schema';
import type { CatalogItem, Item, ItemFilters, ItemStatus, MediaType, NewItemInput } from './types';

export async function getItems(filters: ItemFilters = {}): Promise<Item[]> {
  const conditions: SQL[] = [];

  if (filters.mediaType) {
    conditions.push(eq(items.mediaType, filters.mediaType));
  }

  if (filters.status) {
    conditions.push(eq(items.status, filters.status));
  }

  if (conditions.length === 0) {
    return db.select().from(items).orderBy(desc(items.dateAdded));
  }

  return db
    .select()
    .from(items)
    .where(and(...conditions))
    .orderBy(desc(items.dateAdded));
}

export async function getItemById(id: number): Promise<Item | undefined> {
  const [item] = await db.select().from(items).where(eq(items.id, id)).limit(1);
  return item;
}

export async function findItemByTitleAndType(
  title: string,
  mediaType: MediaType,
): Promise<Item | undefined> {
  const [item] = await db
    .select()
    .from(items)
    .where(and(eq(items.title, title), eq(items.mediaType, mediaType)))
    .limit(1);

  return item;
}

export async function addCatalogItemToLibrary(
  catalogItem: Pick<CatalogItem, 'title' | 'mediaType' | 'coverImageUrl' | 'releaseStatus' | 'mangaOrigin'>,
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
    mangaOrigin: catalogItem.mangaOrigin ?? null,
  });
}

export async function createItem(input: NewItemInput): Promise<Item> {
  const [created] = await db
    .insert(items)
    .values({
      ...input,
      dateAdded: input.dateAdded ?? new Date().toISOString(),
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
  const [updated] = await db.update(items).set(input).where(eq(items.id, id)).returning();
  return updated;
}

export async function deleteItem(id: number): Promise<boolean> {
  const deleted = await db.delete(items).where(eq(items.id, id)).returning({ id: items.id });
  return deleted.length > 0;
}
