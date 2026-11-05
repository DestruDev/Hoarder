-- Cloud copy of each account's library, profile, settings and saved filters.
-- Mirrors the local SQLite tables in src/lib/db/schema.ts. Run once in the
-- Supabase dashboard (SQL Editor) or with `supabase db push`.
--
-- Column conventions:
--   updated_at         client's edit time; the newest edit wins (see trigger below).
--   deleted_at         soft delete, so deletions reach other devices.
--   server_updated_at  set by the server on every write; clients pull rows newer
--                      than the last one they saw, so device clock drift can't
--                      cause missed changes.
-- Content dates (date_added, start_date, ...) stay text so they round-trip
-- exactly as the app stored them.

create table public.items (
  sync_id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  media_type text not null,
  status text not null,
  rating real,
  notes text,
  cover_image_url text,
  release_status text,
  manga_origin text,
  total_episodes integer,
  total_pages integer,
  total_chapters integer,
  current_episodes integer,
  current_pages integer,
  current_chapters integer,
  date_added text not null,
  start_date text,
  finish_date text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table public.saved_filters (
  sync_id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tab text not null,
  name text not null,
  -- JSON-encoded BrowseFilters, kept as text to match the app.
  filters text not null,
  created_at text not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

-- One row per account, so these are keyed by user_id and never deleted.
create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  name text,
  description text,
  avatar_url text,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

create table public.app_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  rating_system text not null,
  library_view text not null,
  explore_view text not null,
  color_scheme text not null,
  -- Comma-separated ItemStatus list, same as the local column.
  library_expanded text not null,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

create index items_user_pull_idx on public.items (user_id, server_updated_at);
create index saved_filters_user_pull_idx on public.saved_filters (user_id, server_updated_at);
create index profiles_user_pull_idx on public.profiles (user_id, server_updated_at);
create index app_settings_user_pull_idx on public.app_settings (user_id, server_updated_at);

-- Last write wins: an upsert carrying an older edit than the stored row is
-- silently skipped, so clients can push with a plain upsert.
create function public.sync_last_write_wins()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;

  new.server_updated_at := now();
  return new;
end;
$$;

create trigger items_last_write_wins
  before insert or update on public.items
  for each row execute function public.sync_last_write_wins();

create trigger saved_filters_last_write_wins
  before insert or update on public.saved_filters
  for each row execute function public.sync_last_write_wins();

create trigger profiles_last_write_wins
  before insert or update on public.profiles
  for each row execute function public.sync_last_write_wins();

create trigger app_settings_last_write_wins
  before insert or update on public.app_settings
  for each row execute function public.sync_last_write_wins();

-- Each account can only see and change its own rows.
alter table public.items enable row level security;
alter table public.saved_filters enable row level security;
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;

create policy "Own items" on public.items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Own saved filters" on public.saved_filters
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Own profile" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Own settings" on public.app_settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.items, public.saved_filters, public.profiles, public.app_settings to authenticated;
