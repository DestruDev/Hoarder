-- "Own profile" (for all) and "Read profiles" (select) both applied to SELECT,
-- so Postgres evaluated two policies per row. Split the owner policy into the
-- write actions only; reads are covered by "Read profiles" alone.

drop policy "Own profile" on public.profiles;

create policy "Create own profile" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Edit own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Delete own profile" on public.profiles
  for delete to authenticated
  using ((select auth.uid()) = user_id);
