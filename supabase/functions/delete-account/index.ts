// Supabase Edge Function: delete-account
//
// Permanently deletes the caller's account and all associated data, per
// Apple App Store Review Guideline 5.1.1(v).
//
// Order of operations (data first, auth last — safe to retry on failure):
//   1. Resolve the caller's user_id from the JWT in the Authorization header.
//   2. Delete every row in `contacts` where user_id = caller.
//   3. Delete the `profiles` row where id = caller.
//   4. Revoke all active sessions / refresh tokens for the user globally.
//   5. Delete the `auth.users` row.
//
// `verify_jwt = true` is set in config.toml, so the platform rejects the
// request before this handler runs if the JWT is missing or invalid. We
// then re-verify by calling getUser() with the user's token to map JWT
// -> user_id; admin operations use the service role.
//
// Secrets needed (already present by default):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: 'Server misconfigured: missing Supabase env vars' }, 500);
  }

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return json({ error: 'Missing or malformed Authorization header' }, 401);
  }

  // Resolve the caller's user_id from the JWT.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user?.id) {
    return json({ error: 'Could not resolve user from token' }, 401);
  }
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey);

  // 1. Delete the caller's contact rows.
  const { error: contactsErr } = await admin
    .from('contacts')
    .delete()
    .eq('user_id', userId);
  if (contactsErr) {
    console.error('delete-account: contacts delete failed', contactsErr);
    return json({ error: 'Failed to delete contacts: ' + contactsErr.message }, 500);
  }

  // 2. Delete the caller's profile row.
  const { error: profileErr } = await admin
    .from('profiles')
    .delete()
    .eq('id', userId);
  if (profileErr) {
    console.error('delete-account: profile delete failed', profileErr);
    return json({ error: 'Failed to delete profile: ' + profileErr.message }, 500);
  }

  // 3. Revoke every active session / refresh token for this user globally.
  // signOut(jwt, 'global') accepts a JWT and revokes all tokens for the
  // owning user across every device, not just the calling session.
  const token = authHeader.slice('Bearer '.length).trim();
  const { error: signOutErr } = await admin.auth.admin.signOut(token, 'global');
  if (signOutErr) {
    console.error('delete-account: global sign-out failed', signOutErr);
    return json({ error: 'Failed to revoke sessions: ' + signOutErr.message }, 500);
  }

  // 4. Delete the auth user. This is the final, unrecoverable step.
  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
  if (deleteErr) {
    console.error('delete-account: auth.users delete failed', deleteErr);
    return json({ error: 'Failed to delete auth user: ' + deleteErr.message }, 500);
  }

  return json({ ok: true });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
