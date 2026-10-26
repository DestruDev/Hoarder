import { desc, eq } from 'drizzle-orm';

import { db } from './client';
import { feedNotifications } from './schema';
import type { FeedNotification, NewFeedNotification } from './types';

export async function getFeedNotifications(): Promise<FeedNotification[]> {
  return db.select().from(feedNotifications).orderBy(desc(feedNotifications.occurredAt));
}

export async function insertFeedNotifications(
  entries: NewFeedNotification[],
): Promise<FeedNotification[]> {
  if (entries.length === 0) {
    return [];
  }

  return db.insert(feedNotifications).values(entries).returning();
}

export async function toggleFeedLike(id: number): Promise<FeedNotification | undefined> {
  const [current] = await db
    .select()
    .from(feedNotifications)
    .where(eq(feedNotifications.id, id))
    .limit(1);

  if (!current) {
    return undefined;
  }

  const liked = !current.liked;
  const likeCount = Math.max(0, current.likeCount + (liked ? 1 : -1));

  const [updated] = await db
    .update(feedNotifications)
    .set({ liked, likeCount })
    .where(eq(feedNotifications.id, id))
    .returning();

  return updated;
}

export async function clearFeedNotifications(): Promise<void> {
  await db.delete(feedNotifications);
}
