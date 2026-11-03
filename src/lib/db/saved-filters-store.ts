import { and, asc, eq } from 'drizzle-orm';

import { getActiveUserId } from './active-user';
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
    .where(and(eq(savedFilters.userId, getActiveUserId()), eq(savedFilters.tab, tab)))
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

  const [created] = await db
    .insert(savedFilters)
    .values({
      userId: getActiveUserId(),
      tab,
      name: name.trim(),
      filters,
      createdAt: new Date().toISOString(),
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

  return created;
}

export async function deleteSavedFilter(id: number): Promise<void> {
  await db
    .delete(savedFilters)
    .where(and(eq(savedFilters.id, id), eq(savedFilters.userId, getActiveUserId())));
}
