import { eq } from 'drizzle-orm';

import { db } from './client';
import { relatedMedia } from './schema';

// Returns the stored JSON for a title's related list, or undefined if never fetched.
export async function getStoredRelatedMedia(sourceKey: string): Promise<string | undefined> {
  const [row] = await db
    .select({ related: relatedMedia.related })
    .from(relatedMedia)
    .where(eq(relatedMedia.sourceKey, sourceKey))
    .limit(1);

  return row?.related;
}

export async function saveRelatedMedia(sourceKey: string, related: string): Promise<void> {
  const fetchedAt = new Date().toISOString();
  await db
    .insert(relatedMedia)
    .values({ sourceKey, related, fetchedAt })
    .onConflictDoUpdate({ target: relatedMedia.sourceKey, set: { related, fetchedAt } });
}

export async function clearRelatedMedia(): Promise<number> {
  const removed = await db.delete(relatedMedia).returning({ sourceKey: relatedMedia.sourceKey });
  return removed.length;
}
