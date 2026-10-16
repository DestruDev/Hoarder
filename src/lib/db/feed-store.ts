import { desc } from 'drizzle-orm';

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

export async function clearFeedNotifications(): Promise<void> {
  await db.delete(feedNotifications);
}
