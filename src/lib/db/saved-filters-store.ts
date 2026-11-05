import { randomUUID } from 'expo-crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { getActiveUserId } from './active-user';
import { notifyLocalWrite } from './changes';
import { db } from './client';
import { savedFilters } from './schema';
import { SAVED_FILTER_LIMIT, type SavedFilter, type SavedFilterTab } from './types';

export async function getSavedFilters(tab: SavedFilterTab): Promise<SavedFilter[]> {
  return db
    .select({
      id: savedFilters.id,
      tab: savedFilters.tab,
      name: savedFilters.name,
      filters: savedFilters.filters,
      createdAt: savedFilters.createdAt,
    })
    .from(savedFilters)
    .where(
      and(
        eq(savedFilters.userId, getActiveUserId()),
        eq(savedFilters.tab, tab),
        isNull(savedFilters.deletedAt),
      ),
    )
    .orderBy(asc(savedFilters.createdAt));
}

export async function createSavedFilter(
  tab: SavedFilterTab,
  name: string,
  filters: string,
): Promise<SavedFilter> {
  const existing = await getSavedFilters(tab);
  if (existing.length >= SAVED_FILTER_LIMIT) {
    throw new Error(`You can save up to ${SAVED_FILTER_LIMIT} filters.`);
  }

  const now = new Date().toISOString();
  const [created] = await db
    .insert(savedFilters)
    .values({
      userId: getActiveUserId(),
      syncId: randomUUID(),
      tab,
      name: name.trim(),
      filters,
      createdAt: now,
      updatedAt: now,
    })
    .returning({
      id: savedFilters.id,
      tab: savedFilters.tab,
      name: savedFilters.name,
      filters: savedFilters.filters,
      createdAt: savedFilters.createdAt,
    });

  if (!created) {
    throw new Error('Failed to save filter');
  }

  notifyLocalWrite();
  return created;
}

export async function deleteSavedFilter(id: number): Promise<void> {
  const now = new Date().toISOString();
  await db
    .update(savedFilters)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(savedFilters.id, id), eq(savedFilters.userId, getActiveUserId())));
  notifyLocalWrite();
}
