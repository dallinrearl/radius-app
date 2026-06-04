-- Migration: codify + tighten RLS on the four legacy relational tables that the
-- initial RLS migration missed (security audit #1, completeness pass).
--
-- Background: an earlier schema stored interactions, interests, reminders, and
-- the contact<->interest join relationally. The app has since moved all of this
-- into contacts.extra (convLog, extra.interests, customFollowUpDate), so these
-- tables are currently EMPTY and the client never references them. They are kept
-- (not dropped) for possible future relational use.
--
-- Each already had RLS enabled with a correct owner-scoped policy, but under the
-- same loose shape we tightened on contacts/profiles: a single `cmd=ALL` policy
-- bound to role `public`, with `anon` holding full table grants. This migration
-- brings them to parity: per-command policies scoped to `authenticated`, anon
-- grants revoked, legacy policies dropped, and the whole thing codified in the
-- repo. Idempotent.
--
-- Ownership: interactions / interests / reminders own by user_id. contact_interests
-- has no user_id; ownership is derived from the joined contact's user_id.

begin;

-- ---- helper pattern applied to the three user_id-owned tables -------------

-- interactions ---------------------------------------------------------------
alter table public.interactions enable row level security;
revoke all on public.interactions from anon;
grant select, insert, update, delete on public.interactions to authenticated;

drop policy if exists "Users see own interactions" on public.interactions;
drop policy if exists interactions_select_own on public.interactions;
create policy interactions_select_own on public.interactions
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists interactions_insert_own on public.interactions;
create policy interactions_insert_own on public.interactions
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists interactions_update_own on public.interactions;
create policy interactions_update_own on public.interactions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists interactions_delete_own on public.interactions;
create policy interactions_delete_own on public.interactions
  for delete to authenticated using (auth.uid() = user_id);

-- interests ------------------------------------------------------------------
alter table public.interests enable row level security;
revoke all on public.interests from anon;
grant select, insert, update, delete on public.interests to authenticated;

drop policy if exists "Users see own interests" on public.interests;
drop policy if exists interests_select_own on public.interests;
create policy interests_select_own on public.interests
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists interests_insert_own on public.interests;
create policy interests_insert_own on public.interests
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists interests_update_own on public.interests;
create policy interests_update_own on public.interests
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists interests_delete_own on public.interests;
create policy interests_delete_own on public.interests
  for delete to authenticated using (auth.uid() = user_id);

-- reminders ------------------------------------------------------------------
alter table public.reminders enable row level security;
revoke all on public.reminders from anon;
grant select, insert, update, delete on public.reminders to authenticated;

drop policy if exists "Users see own reminders" on public.reminders;
drop policy if exists reminders_select_own on public.reminders;
create policy reminders_select_own on public.reminders
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists reminders_insert_own on public.reminders;
create policy reminders_insert_own on public.reminders
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists reminders_update_own on public.reminders;
create policy reminders_update_own on public.reminders
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists reminders_delete_own on public.reminders;
create policy reminders_delete_own on public.reminders
  for delete to authenticated using (auth.uid() = user_id);

-- contact_interests (join table) ---------------------------------------------
-- No user_id; a row is yours iff the contact it points at is yours. The same
-- EXISTS check serves as USING (rows you may read/modify) and WITH CHECK (rows
-- you may write). interest_id is not owner-checked: interests are themselves
-- RLS-protected, so a dangling link to another user's interest_id exposes
-- nothing -- it mirrors the original policy's semantics.
alter table public.contact_interests enable row level security;
revoke all on public.contact_interests from anon;
grant select, insert, update, delete on public.contact_interests to authenticated;

drop policy if exists "Users see own contact_interests" on public.contact_interests;
drop policy if exists contact_interests_select_own on public.contact_interests;
create policy contact_interests_select_own on public.contact_interests
  for select to authenticated
  using (exists (select 1 from public.contacts c
                 where c.id = contact_interests.contact_id and c.user_id = auth.uid()));
drop policy if exists contact_interests_insert_own on public.contact_interests;
create policy contact_interests_insert_own on public.contact_interests
  for insert to authenticated
  with check (exists (select 1 from public.contacts c
                      where c.id = contact_interests.contact_id and c.user_id = auth.uid()));
drop policy if exists contact_interests_update_own on public.contact_interests;
create policy contact_interests_update_own on public.contact_interests
  for update to authenticated
  using (exists (select 1 from public.contacts c
                 where c.id = contact_interests.contact_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.contacts c
                      where c.id = contact_interests.contact_id and c.user_id = auth.uid()));
drop policy if exists contact_interests_delete_own on public.contact_interests;
create policy contact_interests_delete_own on public.contact_interests
  for delete to authenticated
  using (exists (select 1 from public.contacts c
                 where c.id = contact_interests.contact_id and c.user_id = auth.uid()));

commit;
