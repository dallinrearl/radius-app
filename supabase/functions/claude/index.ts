// Supabase Edge Function: claude
//
// Proxies requests from the Veery app to the Anthropic Messages API.
// Reads the API key from the ANTHROPIC_API_KEY secret (set via
// `npx supabase secrets set`).
//
// Expects POST body:
//   { system?, prompt, max_tokens?, tools?, tool_choice? }
// Returns:
//   { text, tool_input? } on success, { error } on failure.
// tool_input is the parsed `input` of the first tool_use block, when
// the client forces structured output via tools/tool_choice.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 1024;

// CORS so the app can call this from a browser (Expo web) or device.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return json({ error: 'ANTHROPIC_API_KEY is not set' }, 500);
  }

  let body: {
    system?: string;
    prompt?: string;
    max_tokens?: number;
    tools?: unknown;
    tool_choice?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const prompt = (body.prompt || '').trim();
  if (!prompt) {
    return json({ error: 'Missing prompt' }, 400);
  }

  // ---- Authn + per-user quota enforcement ----
  // `verify_jwt = true` (config.toml) means the platform already rejected any
  // request without a valid JWT before we got here. We still resolve the user
  // to enforce the per-tier monthly AI quota SERVER-side -- the client-side
  // counter is advisory and trivially bypassed by calling this function directly.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: 'Server misconfigured: missing Supabase env vars' }, 500);
  }

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return json({ error: 'Missing or malformed Authorization header' }, 401);
  }

  // Resolve caller from their JWT.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user?.id) {
    return json({ error: 'Could not resolve user from token' }, 401);
  }
  const userId = userData.user.id;

  // Atomically check + consume one AI call against the user's tier quota.
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: quota, error: quotaErr } = await admin.rpc('consume_ai_call', {
    p_user_id: userId,
  });
  if (quotaErr) {
    console.error('consume_ai_call failed:', quotaErr);
    return json({ error: 'Quota check failed' }, 500);
  }
  if (!quota?.allowed) {
    // 429 so the client can surface the paywall rather than a generic error.
    return json(
      {
        error:
          quota?.reason === 'limit_reached'
            ? 'Monthly AI limit reached for your plan.'
            : 'AI call not permitted.',
        reason: quota?.reason || 'not_allowed',
        limit: quota?.limit,
        count: quota?.count,
      },
      429,
    );
  }

  const system = body.system?.trim() || undefined;
  const maxTokens =
    typeof body.max_tokens === 'number' && body.max_tokens > 0
      ? Math.min(body.max_tokens, 4096)
      : DEFAULT_MAX_TOKENS;

  const tools = Array.isArray(body.tools) && body.tools.length > 0 ? body.tools : undefined;
  const toolChoice = tools && body.tool_choice ? body.tool_choice : undefined;

  // Call the Anthropic Messages API.
  let upstream: Response;
  try {
    upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
        ...(tools ? { tools } : {}),
        ...(toolChoice ? { tool_choice: toolChoice } : {}),
      }),
    });
  } catch (e) {
    return json({ error: 'Network error reaching Anthropic: ' + String(e) }, 502);
  }

  if (!upstream.ok) {
    const errText = await safeText(upstream);
    return json(
      { error: `Anthropic API error (${upstream.status}): ${errText}` },
      upstream.status >= 500 ? 502 : 400,
    );
  }

  const data = await upstream.json();
  const content = Array.isArray(data?.content) ? data.content : [];

  // Concatenate any text blocks for the plain-text path.
  const text = content
    .filter((b: { type: string }) => b?.type === 'text')
    .map((b: { text: string }) => b.text || '')
    .join('\n')
    .trim();

  // If the client forced a tool, pull the parsed input from the first
  // tool_use block. The client treats `tool_input` as the structured result.
  const toolUse = tools
    ? content.find((b: { type: string }) => b?.type === 'tool_use')
    : undefined;
  const toolInput = toolUse?.input;

  if (!text && !toolInput) {
    return json({ error: 'No content returned from Anthropic' }, 502);
  }

  return json({ text, ...(toolInput !== undefined ? { tool_input: toolInput } : {}) });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

async function safeText(r: Response) {
  try {
    return await r.text();
  } catch {
    return '<no body>';
  }
}