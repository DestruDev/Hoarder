-- Find People also matches profile names, ranked:
--   0  handle starts with the query
--   1  name starts with the query
--   2  name contains the query (e.g. a last name)
-- A leading @ means "handle" and searches handles only. Matching ignores case,
-- and %, _ and \ in the query are matched literally.

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
  with q as (
    select
      left(trim(query), 1) = '@' as handle_only,
      replace(replace(replace(lower(trim(leading '@' from trim(query))), '\', '\\'), '%', '\%'), '_', '\_')
        as pattern
  ),
  ranked as (
    select
      u.user_id,
      u.username,
      p.name,
      p.avatar_url,
      case
        when u.username like q.pattern || '%' then 0
        when not q.handle_only and lower(p.name) like q.pattern || '%' then 1
        when not q.handle_only and lower(p.name) like '%' || q.pattern || '%' then 2
      end as rank
    from public.usernames u
    left join public.profiles p on p.user_id = u.user_id
    cross join q
    where q.pattern <> ''
  )
  select
    r.user_id,
    r.username,
    r.name,
    r.avatar_url,
    exists (
      select 1 from public.follows f
      where f.follower_id = (select auth.uid()) and f.followee_id = r.user_id
    )
  from ranked r
  where r.rank is not null
  order by r.rank, r.username
  limit 20;
$$;
