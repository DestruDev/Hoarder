import { db } from './client';
import { profile } from './schema';
import type { Profile } from './types';

const PROFILE_ID = 1;

function normalize(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function getProfile(): Promise<Profile> {
  const [row] = await db.select().from(profile).limit(1);

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

  await db
    .insert(profile)
    .values({
      id: PROFILE_ID,
      name: nextProfile.name,
      description: nextProfile.description,
      avatarUrl: nextProfile.avatarUrl,
    })
    .onConflictDoUpdate({
      target: profile.id,
      set: {
        name: nextProfile.name,
        description: nextProfile.description,
        avatarUrl: nextProfile.avatarUrl,
      },
    });

  return nextProfile;
}
