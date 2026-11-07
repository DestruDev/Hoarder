-- Public or private accounts.
--   private (default): only you and your followers can see your activity.
--   public: any signed-in user can see it (e.g. on your profile page) without
--           following you.
-- The home feed is still you + people you follow either way; public only
-- removes the need to follow before viewing someone's activity.
--
-- Kept in its own server-only table, not on the synced profiles table: the
-- profiles last-write-wins trigger skips updates that don't carry a newer
-- updated_at, which a standalone settings write wouldn't.

create table public.social_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  is_private boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.social_settings enable row level security;

-- Readable by signed-in users so profile pages can say "this account is private".
create policy "Read social settings" on public.social_settings
  for select to authenticated
  using (true);

create policy "Create own social settings" on public.social_settings
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Edit own social settings" on public.social_settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.social_settings from anon, authenticated;
grant select, insert, update on public.social_settings to authenticated;

-- Activity is visible to its author, the author's followers, and, if the
-- author's account is public, every signed-in user. No settings row = private.
drop policy "Read own and followed activity" on public.activities;

create policy "Read own, followed and public activity" on public.activities
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.follows f
      where f.follower_id = (select auth.uid()) and f.followee_id = activities.user_id
    )
    or exists (
      select 1 from public.social_settings s
      where s.user_id = activities.user_id and not s.is_private
    )
  );

-- The home feed (no author given) stays you + people you follow, so public
-- accounts don't flood everyone's feed. A profile page passes `author` and gets
-- whatever RLS allows: all of a public account's activity, or a private one's
-- only if you follow them.
create or replace function public.get_feed(
  author uuid default null,
  following_only boolean default false,
  before_created_at timestamptz default null,
  before_id bigint default null,
  page_size integer default 30
)
returns table (
  id bigint,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  kind text,
  status text,
  title text,
  media_type text,
  manga_origin text,
  cover_image_url text,
  created_at timestamptz,
  like_count bigint,
  liked boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    a.id,
    a.user_id,
    u.username,
    p.name,
    p.avatar_url,
    a.kind,
    a.status,
    a.title,
    a.media_type,
    a.manga_origin,
    a.cover_image_url,
    a.created_at,
    (select count(*) from public.activity_likes l where l.activity_id = a.id),
    exists (
      select 1 from public.activity_likes l
      where l.activity_id = a.id and l.user_id = (select auth.uid())
    )
  from public.activities a
  left join public.usernames u on u.user_id = a.user_id
  left join public.profiles p on p.user_id = a.user_id
  where (author is null or a.user_id = author)
    and (
      author is not null
      or a.user_id = (select auth.uid())
      or exists (
        select 1 from public.follows f
        where f.follower_id = (select auth.uid()) and f.followee_id = a.user_id
      )
    )
    and (not following_only or a.user_id <> (select auth.uid()))
    and (before_created_at is null or (a.created_at, a.id) < (before_created_at, before_id))
  order by a.created_at desc, a.id desc
  limit least(greatest(page_size, 1), 100);
$$;

-- get_public_profile gains is_private. Its result columns change, so it has to
-- be dropped and recreated rather than replaced.
drop function public.get_public_profile(uuid);

create function public.get_public_profile(target uuid)
returns table (
  user_id uuid,
  username text,
  display_name text,
  description text,
  avatar_url text,
  follower_count bigint,
  following_count bigint,
  is_following boolean,
  is_private boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    target,
    (select u.username from public.usernames u where u.user_id = target),
    p.name,
    p.description,
    p.avatar_url,
    (select count(*) from public.follows f where f.followee_id = target),
    (select count(*) from public.follows f where f.follower_id = target),
    exists (
      select 1 from public.follows f
      where f.follower_id = (select auth.uid()) and f.followee_id = target
    ),
    coalesce((select s.is_private from public.social_settings s where s.user_id = target), true)
  from (select 1) as one_row
  left join public.profiles p on p.user_id = target;
$$;

revoke execute on function public.get_public_profile(uuid) from public, anon;
grant execute on function public.get_public_profile(uuid) to authenticated;
