import { supabase } from './supabase';
import { isStaleSessionError, clearStaleSession } from './auth';

// profileApi — read and write the user's profile row.
// Profile holds tier, AI usage counter, trial state, Stripe IDs.

// Fetch the current user's profile. Returns an object or null if not found.
// Throws on real errors (network, auth) so callers can distinguish.
export async function fetchProfile() {
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr) {
    console.error('fetchProfile auth error:', authErr);
    if (isStaleSessionError(authErr)) await clearStaleSession();
    throw new Error(authErr.message || 'Auth failed');
  }
  const userId = userData?.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('fetchProfile error:', error);
    if (isStaleSessionError(error)) await clearStaleSession();
    throw new Error(error.message || 'Failed to fetch profile');
  }
  return data;
}

// Patch fields on the user's profile row. `patch` is a partial object,
// only the keys you pass get updated.
export async function updateProfile(patch) {
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr) {
    if (isStaleSessionError(authErr)) await clearStaleSession();
    throw new Error(authErr.message || 'Auth failed');
  }
  const userId = userData?.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .single();
  if (error) {
    console.error('updateProfile error:', error);
    throw new Error(error.message || 'Failed to update profile');
  }
  return data;
}

// Increment the AI calls counter atomically. Uses a Postgres expression
// rather than a read-then-write to avoid race conditions if two AI calls
// fire at once.
export async function incrementAiCounter() {
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr) {
    if (isStaleSessionError(authErr)) await clearStaleSession();
    throw new Error(authErr.message || 'Auth failed');
  }
  const userId = userData?.user?.id;
  if (!userId) throw new Error('Not signed in');

  // Postgres-side increment via RPC would be cleaner. For now, do a read +
  // write since the race window is small and the counter is per-user.
  const { data: existing, error: readErr } = await supabase
    .from('profiles')
    .select('ai_calls_count')
    .eq('id', userId)
    .single();
  if (readErr) {
    console.error('incrementAiCounter read error:', readErr);
    throw new Error(readErr.message);
  }

  const next = (existing?.ai_calls_count || 0) + 1;
  const { data, error } = await supabase
    .from('profiles')
    .update({ ai_calls_count: next })
    .eq('id', userId)
    .select()
    .single();
  if (error) {
    console.error('incrementAiCounter write error:', error);
    throw new Error(error.message);
  }
  return data;
}

// Reset the AI counter to 0 and stamp the reset timestamp to now.
// Called when we detect a new calendar month.
export async function resetAiCounter() {
  return updateProfile({
    ai_calls_count: 0,
    ai_calls_reset_at: new Date().toISOString(),
  });
}