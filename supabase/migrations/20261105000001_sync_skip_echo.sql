-- A device pushes back rows it just pulled (their updated_at is newer than its
-- push cursor). Skip updates that aren't strictly newer so those echoes don't
-- bump server_updated_at and make every other device re-pull them.
create or replace function public.sync_last_write_wins()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at <= old.updated_at then
    return null;
  end if;

  new.server_updated_at := now();
  return new;
end;
$$;
