// Supabase Edge Function: claude
//
// Proxies requests from the Radius app to the Anthropic Messages API.
// Reads the API key from the ANTHROPIC_API_KEY secret (set via
// `npx supabase secrets set`).
//
// Expects POST body: { system?: string, prompt: string, max_tokens?: number }
// Returns: { text: string } on success, { error: string } on failure.

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

  let body: { system?: string; prompt?: string; max_tokens?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const prompt = (body.prompt || '').trim();
  if (!prompt) {
    return json({ error: 'Missing prompt' }, 400);
  }

  const system = body.system?.trim() || undefined;
  const maxTokens =
    typeof body.max_tokens === 'number' && body.max_tokens > 0
      ? Math.min(body.max_tokens, 4096)
      : DEFAULT_MAX_TOKENS;

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

  // The Messages API returns { content: [{ type: 'text', text: '...' }, ...] }.
  // Concatenate all text blocks into a single string for the client.
  const text = Array.isArray(data?.content)
    ? data.content
        .filter((b: { type: string }) => b?.type === 'text')
        .map((b: { text: string }) => b.text || '')
        .join('\n')
        .trim()
    : '';

  if (!text) {
    return json({ error: 'No text returned from Anthropic' }, 502);
  }

  return json({ text });
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