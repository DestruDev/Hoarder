-- Every status change now gets its own activity, matching AniList: completing
-- and then dropping a title shows both. Previously a status change replaced one
-- from the last 15 minutes, which also deleted any likes on the replaced entry.

create or replace function public.items_record_activity()
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
