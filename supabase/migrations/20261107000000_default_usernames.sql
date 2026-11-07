-- Every account gets a username: a random handle like user_3f9a2c1b, assigned when
-- the account is created (and now, for existing accounts without one). People can
-- change it in Settings; uniqueness and format rules are unchanged.

-- Gives an account a random, unused username if it doesn't have one.
create function public.assign_random_username(account uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  loop
    begin
      insert into public.usernames (user_id, username)
      values (account, 'user_' || substr(md5(gen_random_uuid()::text), 1, 8))
      on conflict (user_id) do nothing;
      return;
    exception
      -- Another account already has this handle: roll a new one.
      when unique_violation then
        null;
    end;
  end loop;
end;
$$;

create function public.handle_new_user_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assign_random_username(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created_username
  after insert on auth.users
  for each row execute function public.handle_new_user_username();

-- Internal helpers: not callable through the API.
revoke execute on function public.assign_random_username(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user_username() from public, anon, authenticated;

-- Existing accounts that never picked a username.
do $$
declare
  account uuid;
begin
  for account in
    select u.id from auth.users u
    where not exists (select 1 from public.usernames n where n.user_id = u.id)
  loop
    perform public.assign_random_username(account);
  end loop;
end;
$$;
