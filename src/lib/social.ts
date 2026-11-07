import type { PostgrestError } from '@supabase/supabase-js';

import type { ComicOrigin, ItemStatus, MediaType } from '@/lib/db/types';
import { supabase } from '@/lib/supabase';

// Online-only social data: usernames, follows, the activity feed and likes.
// Unlike the library this isn't mirrored to SQLite; it's read straight from
// Supabase, where RLS (supabase/migrations/20261106000000_social.sql) decides
// what each account can see. Activity is never written from here: a trigger on
// the synced items table creates it.

export type FeedActivity = {
  id: number;
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  kind: 'added' | 'status';
  status: ItemStatus;
  title: string;
  mediaType: MediaType;
  mangaOrigin: ComicOrigin | null;
  coverImageUrl: string | null;
  createdAt: string;
  likeCount: number;
  liked: boolean;
};

export type UserSummary = {
  userId: string;
  // Null for accounts that haven't claimed a username yet.
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isFollowing: boolean;
};

export type PublicProfile = {
  userId: string;
  username: string | null;
  displayName: string | null;
  description: string | null;
  avatarUrl: string | null;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
};

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
export const USERNAME_RULES = '3–20 characters: lowercase letters, numbers and _';

const FEED_PAGE_SIZE = 30;

function client() {
  if (!supabase) {
    throw new Error('Social features need Supabase. Add your project URL and key to .env.');
  }
  return supabase;
}

function fail(error: PostgrestError, fallback: string): never {
  throw new Error(error.message || fallback);
}

export function normalizeUsername(input: string): string {
  return input.trim().replace(/^@+/, '').toLowerCase();
}

export function displayNameFor(user: { displayName: string | null; username: string | null }): string {
  return user.displayName ?? (user.username ? `@${user.username}` : 'Someone');
}

type FeedRow = {
  id: number;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  kind: FeedActivity['kind'];
  status: ItemStatus;
  title: string;
  media_type: MediaType;
  manga_origin: ComicOrigin | null;
  cover_image_url: string | null;
  created_at: string;
  like_count: number;
  liked: boolean;
};

export async function getFeed(
  options: {
    author?: string;
    followingOnly?: boolean;
    // The last activity already shown; returns the page after it.
    after?: Pick<FeedActivity, 'id' | 'createdAt'>;
  } = {},
): Promise<FeedActivity[]> {
  const { data, error } = await client().rpc('get_feed', {
    author: options.author ?? null,
    following_only: options.followingOnly ?? false,
    before_created_at: options.after?.createdAt ?? null,
    before_id: options.after?.id ?? null,
    page_size: FEED_PAGE_SIZE,
  });
  if (error) {
    fail(error, 'Failed to load feed');
  }

  return (data as FeedRow[]).map((row) => ({
    id: row.id,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    kind: row.kind,
    status: row.status,
    title: row.title,
    mediaType: row.media_type,
    mangaOrigin: row.manga_origin,
    coverImageUrl: row.cover_image_url,
    createdAt: row.created_at,
    likeCount: Number(row.like_count),
    liked: row.liked,
  }));
}

export function hasMoreFeed(page: FeedActivity[]): boolean {
  return page.length === FEED_PAGE_SIZE;
}

export async function setLiked(activityId: number, liked: boolean): Promise<void> {
  const likes = client().from('activity_likes');
  const { error } = liked
    ? await likes.insert({ activity_id: activityId })
    : await likes.delete().eq('activity_id', activityId).eq('user_id', await currentUserId());

  // 23505: already liked (e.g. a double tap raced). The end state is what we wanted.
  if (error && error.code !== '23505') {
    fail(error, liked ? 'Failed to like' : 'Failed to unlike');
  }
}

// Removes one of your own activity entries from every feed. RLS limits deletes
// to the author, so the returned rows tell us whether it actually went.
export async function deleteActivity(activityId: number): Promise<void> {
  const { data, error } = await client().from('activities').delete().eq('id', activityId).select('id');
  if (error) {
    fail(error, 'Failed to delete activity');
  }
  if (!data || data.length === 0) {
    throw new Error("That activity couldn't be deleted.");
  }
}

export async function setFollowing(userId: string, following: boolean): Promise<void> {
  const follows = client().from('follows');
  const { error } = following
    ? await follows.insert({ followee_id: userId })
    : await follows.delete().eq('followee_id', userId).eq('follower_id', await currentUserId());

  if (error && error.code !== '23505') {
    fail(error, following ? 'Failed to follow' : 'Failed to unfollow');
  }
}

export async function searchUsers(query: string): Promise<UserSummary[]> {
  const normalized = normalizeUsername(query);
  if (!normalized) {
    return [];
  }

  const { data, error } = await client().rpc('search_users', { query: normalized });
  if (error) {
    fail(error, 'Search failed');
  }

  return (
    data as {
      user_id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      is_following: boolean;
    }[]
  ).map((row) => ({
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    isFollowing: row.is_following,
  }));
}

export type FollowList = 'followers' | 'following';

const FOLLOW_LIST_LIMIT = 500;

// Who follows `userId`, or who `userId` follows, newest first. Built from the
// follows/usernames/profiles tables, which RLS lets any signed-in user read.
export async function getFollowList(userId: string, list: FollowList): Promise<UserSummary[]> {
  const db = client();
  const [ownColumn, otherColumn] =
    list === 'followers' ? (['followee_id', 'follower_id'] as const) : (['follower_id', 'followee_id'] as const);

  const { data: edges, error } = await db
    .from('follows')
    .select(otherColumn)
    .eq(ownColumn, userId)
    .order('created_at', { ascending: false })
    .limit(FOLLOW_LIST_LIMIT);
  if (error) {
    fail(error, 'Failed to load list');
  }

  return summarizeUsers((edges as Record<string, string>[]).map((edge) => edge[otherColumn]!));
}

// Who liked an activity, newest first. RLS only returns likes on activity the
// caller can see, so this is empty for anything hidden from them.
export async function getActivityLikers(
  activityId: number,
  limit = FOLLOW_LIST_LIMIT,
): Promise<UserSummary[]> {
  const { data, error } = await client()
    .from('activity_likes')
    .select('user_id')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    fail(error, 'Failed to load likes');
  }

  return summarizeUsers((data as { user_id: string }[]).map((row) => row.user_id));
}

// A few likers for a preview, people the caller follows first, each group
// newest first. Only the ids of all likers are fetched; names and avatars are
// loaded just for the ones shown.
export async function getLikesPreview(activityId: number, limit: number): Promise<UserSummary[]> {
  const db = client();
  const { data, error } = await db
    .from('activity_likes')
    .select('user_id')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: false })
    .limit(FOLLOW_LIST_LIMIT);
  if (error) {
    fail(error, 'Failed to load likes');
  }

  const likerIds = (data as { user_id: string }[]).map((row) => row.user_id);
  if (likerIds.length <= limit) {
    return sortFollowedFirst(await summarizeUsers(likerIds));
  }

  const { data: followed, error: followError } = await db
    .from('follows')
    .select('followee_id')
    .eq('follower_id', await currentUserId())
    .in('followee_id', likerIds);
  if (followError) {
    fail(followError, 'Failed to load likes');
  }

  const followedIds = new Set((followed as { followee_id: string }[]).map((row) => row.followee_id));
  const ordered = [
    ...likerIds.filter((id) => followedIds.has(id)),
    ...likerIds.filter((id) => !followedIds.has(id)),
  ];
  return summarizeUsers(ordered.slice(0, limit));
}

// Stable: keeps recency order within each group.
function sortFollowedFirst(users: UserSummary[]): UserSummary[] {
  return [...users.filter((user) => user.isFollowing), ...users.filter((user) => !user.isFollowing)];
}

// Names, avatars and the caller's follow state for a list of user ids, in order.
async function summarizeUsers(ids: string[]): Promise<UserSummary[]> {
  if (ids.length === 0) {
    return [];
  }

  const db = client();
  const me = await currentUserId();
  const [usernames, profiles, myFollows] = await Promise.all([
    db.from('usernames').select('user_id, username').in('user_id', ids),
    db.from('profiles').select('user_id, name, avatar_url').in('user_id', ids),
    db.from('follows').select('followee_id').eq('follower_id', me).in('followee_id', ids),
  ]);
  for (const result of [usernames, profiles, myFollows]) {
    if (result.error) {
      fail(result.error, 'Failed to load people');
    }
  }

  const usernameById = new Map(
    (usernames.data as { user_id: string; username: string }[]).map((row) => [row.user_id, row.username]),
  );
  const profileById = new Map(
    (profiles.data as { user_id: string; name: string | null; avatar_url: string | null }[]).map((row) => [
      row.user_id,
      row,
    ]),
  );
  const followed = new Set((myFollows.data as { followee_id: string }[]).map((row) => row.followee_id));

  return ids.map((id) => ({
    userId: id,
    username: usernameById.get(id) ?? null,
    displayName: profileById.get(id)?.name ?? null,
    avatarUrl: profileById.get(id)?.avatar_url ?? null,
    isFollowing: followed.has(id),
  }));
}

export async function getPublicProfile(userId: string): Promise<PublicProfile> {
  const { data, error } = await client().rpc('get_public_profile', { target: userId }).single();
  if (error) {
    fail(error, 'Failed to load profile');
  }

  const row = data as {
    user_id: string;
    username: string | null;
    display_name: string | null;
    description: string | null;
    avatar_url: string | null;
    follower_count: number;
    following_count: number;
    is_following: boolean;
  };

  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    description: row.description,
    avatarUrl: row.avatar_url,
    followerCount: Number(row.follower_count),
    followingCount: Number(row.following_count),
    isFollowing: row.is_following,
  };
}

// Claims or changes the signed-in account's username. Uniqueness and format are
// enforced by Postgres; this only turns its errors into readable messages.
export async function saveUsername(input: string): Promise<string> {
  const username = normalizeUsername(input);
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error(`Usernames are ${USERNAME_RULES}.`);
  }

  const { error } = await client()
    .from('usernames')
    .upsert({ user_id: await currentUserId(), username }, { onConflict: 'user_id' });

  if (error?.code === '23505') {
    throw new Error(`@${username} is taken.`);
  }
  if (error?.code === '23514') {
    throw new Error(`Usernames are ${USERNAME_RULES}.`);
  }
  if (error) {
    fail(error, 'Failed to save username');
  }

  return username;
}

async function currentUserId(): Promise<string> {
  const { data } = await client().auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) {
    throw new Error('Sign in to continue.');
  }
  return userId;
}
