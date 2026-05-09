// supabase/functions/granola-proxy/index.ts
//
// Edge Function that proxies requests to the Granola Personal API.
// Reason: the Granola API doesn't include CORS headers, so browsers
// block direct calls from the app. This proxy:
//   1. Receives a request from the Radius app with { apiKey, action, params }
//   2. Calls the appropriate Granola endpoint server-side
//   3. Returns the JSON response with CORS headers added
//
// Actions supported:
//   - 'list'   : GET /v1/notes  (with optional created_after, cursor, page_size)
//   - 'get'    : GET /v1/notes/{note_id}?include=transcript
//   - 'test'   : GET /v1/notes?page_size=1  (just verifies the key works)

// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GRANOLA_BASE = 'https://public-api.granola.ai/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { apiKey, action, params } = await req.json();

    if (!apiKey || typeof apiKey !== 'string') {
      return jsonResponse({ error: 'Missing apiKey' }, 400);
    }
    if (!action) {
      return jsonResponse({ error: 'Missing action' }, 400);
    }

    let url = '';
    if (action === 'test') {
      url = `${GRANOLA_BASE}/notes?page_size=1`;
    } else if (action === 'list') {
      const qs = buildQuery(params || {});
      url = `${GRANOLA_BASE}/notes${qs ? '?' + qs : ''}`;
    } else if (action === 'get') {
      const noteId = params?.note_id;
      if (!noteId || typeof noteId !== 'string') {
        return jsonResponse({ error: 'Missing note_id' }, 400);
      }
      const include = params?.include === 'transcript' ? '?include=transcript' : '';
      url = `${GRANOLA_BASE}/notes/${encodeURIComponent(noteId)}${include}`;
    } else {
      return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }

    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    const text = await upstream.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch (_) {
      // leave as text if not JSON
    }

    return jsonResponse(
      {
        status: upstream.status,
        ok: upstream.ok,
        body,
      },
      200,
    );
  } catch (e) {
    return jsonResponse(
      { error: (e as Error).message || 'Proxy error' },
      500,
    );
  }
});

function buildQuery(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.join('&');
}