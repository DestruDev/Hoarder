import { isNull } from 'drizzle-orm';

import { db } from './client';
import { appSettings, items, profile } from './schema';

let activeUserId: string | null = null;

export function getActiveUserId(): string {
  if (!activeUserId) {
    throw new Error('No signed-in user');
  }

  return activeUserId;
}

// Called by AuthProvider whenever the session changes. Rows saved before accounts
// existed have no owner; the first account to sign in claims them.
export async function setActiveUser(userId: string | null): Promise<void> {
  activeUserId = userId;
  if (!userId) {
    return;
  }

  await db.update(items).set({ userId }).where(isNull(items.userId));
  await db.update(profile).set({ userId }).where(isNull(profile.userId));
  await db.update(appSettings).set({ userId }).where(isNull(appSettings.userId));
}
