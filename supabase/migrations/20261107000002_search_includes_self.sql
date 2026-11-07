-- Find People now includes your own account in results (the app shows it with a
-- "You" label instead of a Follow button). Otherwise unchanged.

create or replace function public.search_users(query text)
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
  order by u.username
  limit 20;
$$;
