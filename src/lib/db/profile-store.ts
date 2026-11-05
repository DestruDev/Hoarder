import { eq } from 'drizzle-orm';

import { getActiveUserId } from './active-user';
import { notifyLocalWrite } from './changes';
import { db } from './client';
import { profile } from './schema';
import type { Profile } from './types';

function normalize(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function getProfile(): Promise<Profile> {
  const [row] = await db
    .select()
    .from(profile)
    .where(eq(profile.userId, getActiveUserId()))
    .limit(1);

  return {
    name: row?.name ?? null,
    description: row?.description ?? null,
    avatarUrl: row?.avatarUrl ?? null,
  };
}

export async function saveProfile(input: Profile): Promise<Profile> {
  const nextProfile: Profile = {
    name: normalize(input.name),
    description: normalize(input.description),
    avatarUrl: normalize(input.avatarUrl),
  };

  const updatedAt = new Date().toISOString();
  await db
    .insert(profile)
    .values({
      userId: getActiveUserId(),
      name: nextProfile.name,
      description: nextProfile.description,
      avatarUrl: nextProfile.avatarUrl,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: profile.userId,
      set: {
        name: nextProfile.name,
        description: nextProfile.description,
        avatarUrl: nextProfile.avatarUrl,
        updatedAt,
      },
    });

  notifyLocalWrite();
  return nextProfile;
}
