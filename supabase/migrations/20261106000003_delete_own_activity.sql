-- Authors can delete their own activity, which removes it from every feed (its
-- likes go with it by cascade). Clients still can't insert or edit activity,
-- so it can only ever reflect a real library change. Deleting an entry leaves
-- the library item untouched.

create policy "Delete own activity" on public.activities
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant delete on public.activities to authenticated;
