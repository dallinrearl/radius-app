import { supabase } from './supabase';

export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, user: data.user, session: data.session };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, user: data.user, session: data.session };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
  return data.subscription;
}

// Recognizes the auth error Supabase returns when the JWT references a
// user that no longer exists on the server (deleted account, hard-reset,
// dropped from auth.users). The client may still hold a valid access
// token in memory at this point, so we have to detect it ourselves and
// force a local sign-out rather than waiting for the refresh cycle.
export function isStaleSessionError(error) {
  if (!error) return false;
  const code = String(error.code || '').toLowerCase();
  if (code === 'user_not_found' || code === 'session_not_found') return true;
  const msg = String(error.message || '').toLowerCase();
  return msg.includes('user from sub claim') || msg.includes('user not found');
}

// Best-effort local sign-out. Used when the server has invalidated the
// user (e.g. account deletion) so the app drops back to the auth screen
// instead of hammering the API with a doomed token.
export async function clearStaleSession() {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (e) {
    console.warn('clearStaleSession failed:', e?.message);
  }
}