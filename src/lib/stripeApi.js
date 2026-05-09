import { supabase } from './supabase';

// stripeApi — thin client for our Stripe Edge Function.
// All actual Stripe communication happens server-side. This module just
// authenticates with Supabase and POSTs to the function endpoints.

// Build the function base URL from the supabase client config so we don't
// have to hardcode it here.
function functionBaseUrl() {
  // supabase-js exposes the project URL on the client. Append the
  // /functions/v1/<name> path to hit Edge Functions.
  const url = supabase.supabaseUrl || '';
  return url.replace(/\/$/, '') + '/functions/v1/stripe';
}

async function authHeaders() {
  // Get the user's current access token to pass to the Edge Function.
  // The function uses this to identify the user and verify auth.
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) {
    throw new Error('Not signed in');
  }
  return {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
  };
}

// Create a checkout session. Returns the Stripe-hosted URL the user
// needs to be redirected to in order to complete payment.
//
// plan: 'monthly' | 'annual'
// trial: boolean — start with 7-day free trial period
export async function createCheckoutSession({ plan = 'monthly', trial = false }) {
  const headers = await authHeaders();
  const res = await fetch(functionBaseUrl() + '/checkout', {
    method: 'POST',
    headers,
    body: JSON.stringify({ plan, trial }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('createCheckoutSession failed:', res.status, text);
    throw new Error('Could not start checkout: ' + (text || res.status));
  }
  const data = await res.json();
  if (!data?.url) {
    throw new Error('Checkout session missing URL');
  }
  return data; // { url, sessionId }
}

// Create a billing portal session. Returns the URL where the user can
// manage their subscription (cancel, update card, view invoices).
export async function createPortalSession() {
  const headers = await authHeaders();
  const res = await fetch(functionBaseUrl() + '/portal', {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('createPortalSession failed:', res.status, text);
    throw new Error('Could not open billing portal: ' + (text || res.status));
  }
  const data = await res.json();
  if (!data?.url) {
    throw new Error('Portal session missing URL');
  }
  return data; // { url }
}