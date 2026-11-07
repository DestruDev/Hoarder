-- Social feed: usernames, follows, server-generated activity and likes.
--
-- Security model (open follow, Twitter-style):
--   usernames       readable by any signed-in user; each account writes only its own.
--   profiles        now readable by any signed-in user (name/bio/avatar are public
--                   identity); writes stay owner-only.
--   follows         readable by any signed-in user; you can only create or delete
--                   rows where you are the follower. No self-follows.
--   activities      written ONLY by a trigger on public.items. Clients have no
--                   insert/update/delete privilege, so activity can't be forged and
--                   always reflects a real library change. Readable by the author
--                   and the author's followers. Contains only public fields
--                   (no notes, no rating).
--   activity_likes  you can like only as yourself, and only activities you can see;
--                   likes inherit the visibility of their activity.
-- anon gets nothing on any of these tables.

-- Usernames -------------------------------------------------------------------

create table public.usernames (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  constraint usernames_format check (username ~ '^[a-z0-9_]{3,20}$')
);

create unique index usernames_username_key on public.usernames (username);

alter table public.usernames enable row level security;

create policy "Read usernames" on public.usernames
  for select to authenticated
  using (true);

create policy "Claim own username" on public.usernames
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Change own username" on public.usernames
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Release own username" on public.usernames
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Profiles become publicly readable to signed-in users. "Own profile" (for all)
-- still limits writes to the owner; permissive policies OR together for select.
-- Sync pulls filter on user_id explicitly, so this doesn't pull other profiles.
create policy "Read profiles" on public.profiles
  for select to authenticated
  using (true);

-- Follows ---------------------------------------------------------------------

create table public.follows (
  follower_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_no_self check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id);

alter table public.follows enable row level security;

create policy "Read follows" on public.follows
  for select to authenticated
  using (true);

create policy "Follow as yourself" on public.follows
  for insert to authenticated
  with check ((select auth.uid()) = follower_id);

create policy "Unfollow as yourself" on public.follows
  for delete to authenticated
  using ((select auth.uid()) = follower_id);

-- Activities ------------------------------------------------------------------

create table public.activities (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_sync_id uuid not null references public.items (sync_id) on delete cascade,
  -- 'added': item joined the library (status = the status it was added with).
  -- 'status': item moved to status (completed, dropped or planning).
  kind text not null check (kind in ('added', 'status')),
  status text not null,
  -- Snapshot of public fields at event time. Followers can't read items rows.
  title text not null,
  media_type text not null,
  manga_origin text,
  cover_image_url text,
  created_at timestamptz not null default now()
);

create index activities_feed_idx on public.activities (user_id, created_at desc, id desc);
create index activities_created_idx on public.activities (created_at desc, id desc);
create index activities_item_idx on public.activities (item_sync_id);

alter table public.activities enable row level security;

create policy "Read own and followed activity" on public.activities
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.follows f
      where f.follower_id = (select auth.uid()) and f.followee_id = activities.user_id
    )
  );

-- Turns synced library changes into activity. Runs after the last-write-wins
-- trigger, so skipped (stale) upserts never produce events.
--
-- Only edits made in the last 7 days (client time) count, so syncing an old
-- library from a new install doesn't flood followers, while a device that was
-- offline for a few days still posts its changes.
create function public.items_record_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_kind text;
  recent boolean := new.updated_at > now() - interval '7 days';
begin
  -- Item removed: its activity (and, by cascade, likes) goes with it.
  if tg_op = 'UPDATE' and new.deleted_at is not null and old.deleted_at is null then
    delete from public.activities where item_sync_id = new.sync_id;
    return null;
  end if;

  if new.deleted_at is not null or not recent then
    return null;
  end if;

  if tg_op = 'INSERT' then
    event_kind := 'added';
  elsif new.status is distinct from old.status
    and new.status in ('completed', 'dropped', 'planning') then
    event_kind := 'status';
    -- Coalesce flip-flopping: a newer status change replaces one from the last
    -- 15 minutes instead of stacking up.
    delete from public.activities
    where item_sync_id = new.sync_id
      and kind = 'status'
      and created_at > now() - interval '15 minutes';
  else
    return null;
  end if;

  insert into public.activities
    (user_id, item_sync_id, kind, status, title, media_type, manga_origin, cover_image_url, created_at)
  values
    (new.user_id, new.sync_id, event_kind, new.status, new.title, new.media_type,
     new.manga_origin, new.cover_image_url, least(new.updated_at, now()));

  return null;
end;
$$;

revoke execute on function public.items_record_activity() from public, anon, authenticated;

create trigger items_record_activity
  after insert or update on public.items
  for each row execute function public.items_record_activity();

-- Likes -----------------------------------------------------------------------

create table public.activity_likes (
  activity_id bigint not null references public.activities (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create index activity_likes_user_idx on public.activity_likes (user_id);

alter table public.activity_likes enable row level security;

-- The activities subquery is itself filtered by the activities policy, so a like
-- is visible (and creatable) only where its activity is.
create policy "Read likes on visible activity" on public.activity_likes
  for select to authenticated
  using (exists (select 1 from public.activities a where a.id = activity_id));

create policy "Like visible activity as yourself" on public.activity_likes
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.activities a where a.id = activity_id)
  );

create policy "Unlike as yourself" on public.activity_likes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Privileges --------------------------------------------------------------------
-- Explicit grants instead of Supabase's broad defaults. activities is read-only
-- to clients; the trigger above is the only writer.

revoke all on public.usernames, public.follows, public.activities, public.activity_likes
  from anon, authenticated;

grant select, insert, update, delete on public.usernames to authenticated;
grant select, insert, delete on public.follows to authenticated;
grant select on public.activities to authenticated;
grant select, insert, delete on public.activity_likes to authenticated;

-- RPCs ------------------------------------------------------------------------
-- All security invoker: they run as the caller, so the RLS above still decides
-- what each one returns.

-- One page of the caller's feed, newest first. Keyset pagination: pass the
-- created_at and id of the last row to get the next page.
--   author          only this user's activity (e.g. a profile page)
--   following_only  exclude the caller's own activity
create function public.get_feed(
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
    and (not following_only or a.user_id <> (select auth.uid()))
    and (before_created_at is null or (a.created_at, a.id) < (before_created_at, before_id))
  order by a.created_at desc, a.id desc
  limit least(greatest(page_size, 1), 100);
$$;

-- Username prefix search for "Find people".
create function public.search_users(query text)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_following boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    u.user_id,
    u.username,
    p.name,
    p.avatar_url,
    exists (
      select 1 from public.follows f
      where f.follower_id = (select auth.uid()) and f.followee_id = u.user_id
    )
  from public.usernames u
  left join public.profiles p on p.user_id = u.user_id
  where length(trim(query)) > 0
    and u.username like
      replace(replace(replace(lower(trim(leading '@' from trim(query))), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    and u.user_id <> (select auth.uid())
  order by u.username
  limit 20;
$$;

-- Header data for a profile page.
create function public.get_public_profile(target uuid)
returns table (
  user_id uuid,
  username text,
  display_name text,
  description text,
  avatar_url text,
  follower_count bigint,
  following_count bigint,
  is_following boolean
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
    )
  from (select 1) as one_row
  left join public.profiles p on p.user_id = target;
$$;

revoke execute on function public.get_feed(uuid, boolean, timestamptz, bigint, integer) from public, anon;
revoke execute on function public.search_users(text) from public, anon;
revoke execute on function public.get_public_profile(uuid) from public, anon;

grant execute on function public.get_feed(uuid, boolean, timestamptz, bigint, integer) to authenticated;
grant execute on function public.search_users(text) to authenticated;
grant execute on function public.get_public_profile(uuid) to authenticated;
