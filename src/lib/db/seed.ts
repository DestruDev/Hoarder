import { createItem, getItems } from './items';

const DUMMY_TITLE = '[DB TEST] Dummy Item';

/**
 * Inserts a dummy row on first launch so you can confirm SQLite + Drizzle work.
 * Remove this call from `src/app/_layout.tsx` once you've verified the DB layer.
 */
export async function seedDummyItemIfEmpty(): Promise<void> {
  const existing = await getItems();

  if (existing.length > 0) {
    console.log(`[Hoarder DB] ${existing.length} item(s) already in the database.`);
    console.log('[Hoarder DB] Sample item:', existing[0]);
    return;
  }

  const item = await createItem({
    title: DUMMY_TITLE,
    mediaType: 'anime',
    status: 'planning',
    rating: 8,
    notes: 'Inserted on first launch to confirm SQLite + Drizzle are working. Safe to delete.',
    coverImageUrl: null,
  });

  console.log('[Hoarder DB] Inserted dummy item:', item);
}
