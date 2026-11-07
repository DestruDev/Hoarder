-- Server-side rules for offline-first sync (supabase/migrations/20261105000000_sync.sql
-- and 20261105000001_sync_skip_echo.sql): last write wins on updated_at, the
-- server owns server_updated_at, and each account only reaches its own rows.
-- Client-side behaviour is tested in src/lib/__tests__/sync-engine.test.ts.
--
-- Uploads are written the way supabase-js upsert sends them through PostgREST:
-- INSERT ... ON CONFLICT (key) DO UPDATE SET <every column> = excluded.<column>.
--
-- Run after applying migrations:
--   npx supabase db query --remote --yes -f supabase/tests/sync_lww.sql
-- One transaction, rolled back. Passing checks emit NOTICE "ok - ..."; the first
-- failure aborts with "FAIL: ...". A clean run returns a single empty row.

begin;

create function pg_temp.login(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end;
$$;

create function pg_temp.check(passed boolean, description text) returns void
language plpgsql as $$
begin
  if passed is not true then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

create function pg_temp.check_denied(statement text, expected_state text, description text)
returns void
language plpgsql as $$
begin
  execute statement;
  raise exception 'FAIL: % (statement succeeded)', description;
exception
  when others then
    if sqlerrm like 'FAIL:%' then
      raise;
    end if;
    if sqlstate <> expected_state then
      raise exception 'FAIL: % (got % "%", expected %)', description, sqlstate, sqlerrm, expected_state;
    end if;
    raise notice 'ok - %', description;
end;
$$;

-- An upload of one items row, as the client sends it.
create function pg_temp.upload(sync_id uuid, title text, updated_at timestamptz,
  deleted_at timestamptz default null) returns void
language sql as $$
  insert into public.items (sync_id, title, media_type, status, date_added, updated_at, deleted_at,
                            server_updated_at)
  values (sync_id, title, 'anime', 'planning', '2026-01-01T00:00:00.000Z', updated_at, deleted_at,
          '2000-01-01T00:00:00Z')
  on conflict (sync_id) do update set
    title = excluded.title,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at,
    server_updated_at = excluded.server_updated_at;
$$;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-00000000000a', 'a@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'b@test.local', 'authenticated', 'authenticated');

-- Last write wins ------------------------------------------------------------------

select pg_temp.login('00000000-0000-4000-8000-00000000000a');
select pg_temp.upload('20000000-0000-4000-8000-000000000001', 'First', '2026-01-01T10:00:00Z');

select pg_temp.check(
  (select server_updated_at from public.items where sync_id = '20000000-0000-4000-8000-000000000001') = now(),
  'server_updated_at is set by the server, ignoring the value the client sent');
select pg_temp.check(
  (select user_id from public.items where sync_id = '20000000-0000-4000-8000-000000000001')
    = '00000000-0000-4000-8000-00000000000a',
  'user_id defaults to the signed-in account');

select pg_temp.upload('20000000-0000-4000-8000-000000000001', 'Newer', '2026-01-01T11:00:00Z');
select pg_temp.check(
  (select title from public.items where sync_id = '20000000-0000-4000-8000-000000000001') = 'Newer',
  'a newer edit replaces the stored row');

select pg_temp.upload('20000000-0000-4000-8000-000000000001', 'Older', '2026-01-01T09:00:00Z');
select pg_temp.check(
  (select title from public.items where sync_id = '20000000-0000-4000-8000-000000000001') = 'Newer',
  'an older edit that syncs late is skipped');

select pg_temp.upload('20000000-0000-4000-8000-000000000001', 'Same time', '2026-01-01T11:00:00Z');
select pg_temp.check(
  (select title from public.items where sync_id = '20000000-0000-4000-8000-000000000001') = 'Newer',
  'an edit with the same updated_at is skipped (first write to arrive wins ties; echoes are no-ops)');

select pg_temp.upload('20000000-0000-4000-8000-000000000001', 'Newer', '2026-01-01T12:00:00Z',
  '2026-01-01T12:00:00Z');
select pg_temp.check(
  (select deleted_at from public.items where sync_id = '20000000-0000-4000-8000-000000000001') is not null,
  'a newer soft delete is stored, so it reaches other devices');

select pg_temp.upload('20000000-0000-4000-8000-000000000001', 'Resurrected', '2026-01-01T11:30:00Z');
select pg_temp.check(
  (select deleted_at from public.items where sync_id = '20000000-0000-4000-8000-000000000001') is not null,
  'an older edit does not bring a deleted item back');

-- Accounts are isolated -------------------------------------------------------------

select pg_temp.login('00000000-0000-4000-8000-00000000000b');
select pg_temp.check(
  (select count(*) from public.items) = 0,
  'B cannot read A''s library');
select pg_temp.check_denied(
  $$select pg_temp.upload('20000000-0000-4000-8000-000000000001', 'Hijacked', '2027-01-01T00:00:00Z')$$,
  '42501', 'B cannot overwrite A''s item, even with a newer updated_at');
select pg_temp.check_denied(
  $$insert into public.items (sync_id, user_id, title, media_type, status, date_added, updated_at)
    values ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a',
            'Planted', 'anime', 'planning', '2026-01-01', now())$$,
  '42501', 'B cannot create an item in A''s library');
select pg_temp.check_denied(
  $$insert into public.profiles (user_id, name, updated_at)
    values ('00000000-0000-4000-8000-00000000000a', 'Hijacked', '2027-01-01')
    on conflict (user_id) do update set name = excluded.name, updated_at = excluded.updated_at$$,
  '42501', 'B cannot overwrite A''s profile');
select pg_temp.check_denied(
  $$insert into public.app_settings (user_id, rating_system, library_view, explore_view,
      color_scheme, library_expanded, updated_at)
    values ('00000000-0000-4000-8000-00000000000a', 'whole', 'list', 'card', 'dark', '', now())$$,
  '42501', 'B cannot write A''s settings');

reset role;
select pg_temp.check(
  (select title from public.items where sync_id = '20000000-0000-4000-8000-000000000001') = 'Newer',
  'A''s item is unchanged after B''s attempts');

rollback;
