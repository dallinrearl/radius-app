-- Migration: enable + codify Row-Level Security on the two user-data tables.
--
-- Context: the Veery client ships the public anon key and performs ALL of its
-- data access with no application-side ownership filtering -- e.g. fetchContacts
-- does `select('*')` with no user_id filter (src/lib/contactsApi.js), and
-- updateProfile filters only by `id` (src/lib/profileApi.js). That is only safe
-- because Postgres RLS scopes every row to its owner. Those policies previously
-- lived only in the dashboard (not in version control, not reviewable, free to
-- drift). This migration brings them into the repo as the single source of
-- truth. It is idempotent: re-running converges the database to exactly this
-- policy set.
--
-- Surface: only `public.contacts` and `public.profiles` are exposed via
-- PostgREST; everything else the app uses is local device storage.
--
-- Note: the service-role key (used by the delete-account and send-notifications
-- Edge Functions) bypasses RLS, so those functions are unaffected. We use plain
-- `enable row level security` (NOT `force`): RLS applies to the anon and
-- authenticated roles PostgREST uses, which is the entire client threat
-- surface. `force` would also subject the table-OWNER role to RLS, which can
-- break SECURITY DEFINER functions that write these tables as the owner --
-- notably the signup trigger that inserts the profiles row (there is no INSERT
-- policy for it). The owner role never serves client API traffic, so `force`
-- adds no protection against the threat we care about, only breakage risk.
--
-- Legacy policies replaced: a live inspection (pg_policies) found one
-- pre-existing policy per table -- "Users see own contacts" and "Users see own
-- profile", both `cmd=ALL` scoped to role `public` and (correctly) keyed on the
-- owner. RLS policies are permissive and OR'd together, so this migration drops
-- those by name before creating the explicit per-command, authenticated-scoped
-- set below; otherwise the loose old policies would linger and OR in alongside
-- the tighter ones.
--
-- NOT covered here: column-level protection of entitlement fields
-- (profiles.tier, ai_calls_count, trial_*). The profiles_update_own policy
-- below intentionally lets a user update their OWN profile row, which still
-- includes those columns. Preventing self-upgrade-to-Pro is a separate
-- column-privilege migration that follows this one.

begin;

-- ===========================================================================
-- contacts -- full per-user ownership, keyed on contacts.user_id = auth.uid()
-- ===========================================================================
alter table public.contacts enable row level security;

-- The app has no anonymous functionality; sign-in is required for everything.
-- With RLS enabled and no anon policy, anon cannot read rows; we also revoke
-- the default grant so the intent is explicit. We then (re)assert the grants
-- the authenticated role needs, so revoking anon can never strand logged-in
-- users even if the table's grants were configured unusually. (RLS, not the
-- grant, is what restricts authenticated users to their own rows.)
revoke all on public.contacts from anon;
grant select, insert, update, delete on public.contacts to authenticated;

-- Drop the legacy single ALL/public policy (found live) so only the explicit
-- per-command, authenticated-scoped policies below remain.
drop policy if exists "Users see own contacts" on public.contacts;

drop policy if exists contacts_select_own on public.contacts;
create policy contacts_select_own on public.contacts
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists contacts_insert_own on public.contacts;
create policy contacts_insert_own on public.contacts
  for insert to authenticated
  with check (auth.uid() = user_id);

-- UPDATE needs both USING (which existing rows you may target) and WITH CHECK
-- (what the row may look like after) so a user cannot reassign a row to, or
-- away from, another user_id. syncContacts() uses upsert, which requires both
-- the insert and update policies to be satisfied.
drop policy if exists contacts_update_own on public.contacts;
create policy contacts_update_own on public.contacts
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists contacts_delete_own on public.contacts;
create policy contacts_delete_own on public.contacts
  for delete to authenticated
  using (auth.uid() = user_id);

-- ===========================================================================
-- profiles -- one row per user, keyed on profiles.id = auth.uid()
-- ===========================================================================
alter table public.profiles enable row level security;

-- Authenticated users only ever select and update their own profile row;
-- creation and deletion happen server-side. Grant exactly that, and revoke anon.
revoke all on public.profiles from anon;
grant select, update on public.profiles to authenticated;

-- Drop the legacy single ALL/public policy (found live). With only the select +
-- update policies below remaining, RLS denies INSERT/DELETE on profiles for
-- authenticated users even though the table grant exists -- row creation stays
-- with the handle_new_user trigger, deletion with the service-role function.
drop policy if exists "Users see own profile" on public.profiles;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (auth.uid() = id);

-- The client only ever selects and updates its own profile (profileApi.js).
-- Row creation happens server-side (handle_new_user trigger / service role),
-- so there is deliberately no INSERT policy for authenticated users. Deletion
-- runs through the service-role delete-account function, so there is no DELETE
-- policy either.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

commit;
