-- Migration: server-side AI quota enforcement (security audit #3).
--
-- Problem: the `claude` Edge Function enforces nothing. Any caller with a valid
-- JWT can POST to it directly, bypass the client-side counter, and run unlimited
-- Anthropic calls on our bill.
--
-- Design: the authoritative usage counter lives in a dedicated `ai_usage` table
-- that has RLS enabled with NO policies, so neither `anon` nor `authenticated`
-- can read or write it -- only the service role (via the SECURITY DEFINER
-- function below, which the Edge Function calls) can. This deliberately does
-- NOT reuse profiles.ai_calls_count, because the existing client also writes
-- that column: sharing it would either double-count (client +1 AND server +1)
-- or, if we locked it, strand free users at month rollover when the client's
-- reset write fails. Keeping a separate server-owned counter lets the client's
-- advisory counter keep working untouched while the server enforces a counter
-- users cannot forge. profiles.ai_calls_count is now ADVISORY (client UX only)
-- and is intentionally not used for enforcement.
--
-- Mirrors src/utils/tierLimits.js: free = 5/month; pro and ACTIVE trial =
-- unlimited; an expired trial is metered as free (stricter than today's client,
-- which has no trial->free downgrade -- the payments rework owns reconciling it).
--
-- consume_ai_call returns jsonb:
--   { allowed: bool, reason?: text, tier: text, count?: int, limit?: int, unlimited?: bool }

begin;

-- ---------------------------------------------------------------------------
-- Server-only usage table. RLS on + zero policies = locked to clients; the
-- SECURITY DEFINER function (owned by postgres) bypasses RLS as table owner.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  period_month date not null,                 -- first day of the counted month (UTC)
  count        int  not null default 0,
  updated_at   timestamptz not null default now()
);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon;
revoke all on public.ai_usage from authenticated;

create or replace function public.consume_ai_call(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier           text;
  v_trial_expires  timestamptz;
  v_now            timestamptz := now();
  v_month          date := date_trunc('month', v_now)::date;
  v_effective_tier text;
  v_count          int;
  v_stored_month   date;
  v_free_limit     constant int := 5;   -- mirrors TIER_LIMITS.free.aiCallsPerMonth
begin
  select tier, trial_expires_at
    into v_tier, v_trial_expires
  from public.profiles
  where id = p_user_id;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'no_profile');
  end if;

  -- Unlimited only for pro and a CURRENTLY-active trial. Expired/absent trial
  -- (or any unknown tier) is metered as free. See header note on trial lifecycle.
  if v_tier = 'pro' then
    v_effective_tier := 'pro';
  elsif v_tier = 'trial'
        and v_trial_expires is not null
        and v_trial_expires > v_now then
    v_effective_tier := 'trial';
  else
    v_effective_tier := 'free';
  end if;

  if v_effective_tier in ('pro', 'trial') then
    return jsonb_build_object('allowed', true, 'tier', v_effective_tier, 'unlimited', true);
  end if;

  -- Free tier: check + consume against ai_usage atomically.
  insert into public.ai_usage (user_id, period_month, count)
    values (p_user_id, v_month, 0)
    on conflict (user_id) do nothing;

  -- Row-lock so two concurrent calls can't both pass the limit check.
  select count, period_month
    into v_count, v_stored_month
  from public.ai_usage
  where user_id = p_user_id
  for update;

  -- New calendar month -> reset the counter before evaluating the limit.
  if v_stored_month <> v_month then
    v_count := 0;
    update public.ai_usage
      set period_month = v_month, count = 0, updated_at = v_now
      where user_id = p_user_id;
  end if;

  if v_count >= v_free_limit then
    return jsonb_build_object(
      'allowed', false, 'reason', 'limit_reached',
      'tier', 'free', 'count', v_count, 'limit', v_free_limit
    );
  end if;

  update public.ai_usage
    set count = count + 1, updated_at = v_now
    where user_id = p_user_id
    returning count into v_count;

  return jsonb_build_object(
    'allowed', true, 'tier', 'free', 'count', v_count, 'limit', v_free_limit
  );
end;
$$;

-- Only the service role (used by the Edge Function) may execute this.
revoke all on function public.consume_ai_call(uuid) from public;
revoke all on function public.consume_ai_call(uuid) from anon;
revoke all on function public.consume_ai_call(uuid) from authenticated;
grant execute on function public.consume_ai_call(uuid) to service_role;

commit;
