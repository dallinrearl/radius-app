-- Migration: lock entitlement columns on public.profiles against client writes.
--
-- Problem (security audit #2 -- privilege escalation / broken access control):
-- the RLS policy `profiles_update_own` lets a user update their OWN profile
-- row, which is correct for settings -- but the row also holds the columns that
-- decide what the user has paid for (tier, trial window, subscription state).
-- With only RLS in place, any authenticated user can run
--   update profiles set tier = 'pro' where id = auth.uid()
-- and grant themselves a paid plan for free. RLS controls which ROWS you may
-- touch, not which COLUMNS, so this needs column-level privileges.
--
-- Fix: revoke the blanket UPDATE grant from `authenticated` and grant UPDATE
-- back only on the columns the client legitimately writes. Postgres then
-- rejects any UPDATE that targets a non-granted column (error 42501), while
-- normal settings writes are unaffected. The locked columns are simply absent
-- from the grant list -- they are never named here, so dropping them later
-- (e.g. when Stripe is removed) does not affect this migration.
--
-- Unaffected: the service-role key (used by Edge Functions and any future
-- IAP receipt-validation that sets `tier`) bypasses these grants entirely; the
-- handle_new_user trigger that creates the row runs as the table owner.
--
-- Columns the client actually updates today (verified against the source):
--   notifications_enabled, notif_overdue, notif_birthdays  (saveNotificationPrefs)
--   expo_push_token, timezone                              (notifications.js)
--   ai_calls_count, ai_calls_reset_at                      (increment/resetAiCounter)
-- Plus the user's own profile data columns (full_name, email, my_card, settings,
-- granola_api_key) which are user-owned and non-sensitive, granted for forward
-- compatibility even though they are currently persisted client-side.
--
-- LOCKED (NOT granted to authenticated): tier, trial_started_at,
--   trial_expires_at, stripe_customer_id, stripe_subscription_id,
--   stripe_subscription_status, plus identity/server-managed columns
--   (id, created_at, updated_at, last_notification_sent_at).
--
-- DEFERRED to audit item #3 (server-side AI metering): ai_calls_count and
-- ai_calls_reset_at remain writable here because the client increments them.
-- A user can therefore still reset their own AI usage counter -- locking these
-- only makes sense once the `claude` Edge Function enforces usage server-side,
-- otherwise every AI call would break. Tracked with #3, not fixed here.

begin;

-- Drop the blanket table-level UPDATE, then re-grant only the safe columns.
-- (Postgres has no "update all columns except X"; you revoke the table grant
-- and grant the specific columns.) SELECT/INSERT grants are left as-is; RLS
-- still has no INSERT policy on profiles, so inserts remain blocked regardless.
revoke update on public.profiles from authenticated;

grant update (
  full_name,
  email,
  my_card,
  settings,
  granola_api_key,
  expo_push_token,
  timezone,
  notifications_enabled,
  notif_overdue,
  notif_birthdays,
  ai_calls_count,       -- DEFERRED (#3): client increments this today
  ai_calls_reset_at     -- DEFERRED (#3): client resets this today
) on public.profiles to authenticated;

commit;
