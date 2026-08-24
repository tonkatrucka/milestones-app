/**
 * digest-unsubscribe edge function
 *
 * One-tap unsubscribe from family digest emails. The link is a signed JWT
 * (HMAC-SHA256 with DIGEST_SECRET) so the follower id cannot be guessed.
 * Marks the follower inactive rather than deleting the row, so the owner
 * can still see them as paused in Settings.
 *
 * No JavaScript required — works from any email client.
 */

import { createClient } from 'npm:@supabase/supabase-js';

const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'no-store',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-client-info, apikey',
};

async function verifyJwt(
  token: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  try {
    const [headerB64, payloadB64, sigB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !sigB64) return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sigInput = encoder.encode(`${headerB64}.${payloadB64}`);
    const sigBytes = Uint8Array.from(
      atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0),
    );
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, sigInput);
    if (!valid) return null;

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
</head>
<body style="margin:0;background:#F0EBE3;font-family:-apple-system,Helvetica,Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
<div style="text-align:center;padding:32px;max-width:420px;">
  <div style="font-size:48px;margin-bottom:16px;">✉️</div>
  <h2 style="color:#1a1a1a;margin:0 0 8px;">${title}</h2>
  <p style="color:#666;font-size:15px;line-height:22px;">${body}</p>
</div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return new Response(
      page('Link not valid', 'This unsubscribe link is missing. Use the link in the most recent digest email.'),
      { status: 400, headers: HTML_HEADERS },
    );
  }

  const digestSecret = Deno.env.get('DIGEST_SECRET') ?? '';
  if (!digestSecret) {
    return new Response(page('Something went wrong', 'Please try again later.'), {
      status: 500,
      headers: HTML_HEADERS,
    });
  }

  const payload = await verifyJwt(token, digestSecret);
  const followerId = typeof payload?.followerId === 'string' ? payload.followerId : null;
  const purpose = payload?.purpose;
  if (!payload || purpose !== 'unsubscribe' || !followerId) {
    return new Response(
      page('Link expired', 'This unsubscribe link is invalid or has expired. Ask the family to pause your emails from Settings.'),
      { status: 401, headers: HTML_HEADERS },
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const adminDb = createClient(supabaseUrl, serviceRoleKey);

    const { data: follower } = await adminDb
      .from('digest_followers')
      .select('id, is_active, email, child_id, children(name)')
      .eq('id', followerId)
      .maybeSingle();

    if (!follower) {
      return new Response(
        page('Already removed', 'You are not on this digest list.'),
        { status: 200, headers: HTML_HEADERS },
      );
    }

    // deno-lint-ignore no-explicit-any
    const childName = (follower as any).children?.name as string | undefined;

    if (!follower.is_active) {
      return new Response(
        page(
          'Already unsubscribed',
          childName
            ? `You will not receive further emails about ${childName}.`
            : 'You will not receive further digest emails.',
        ),
        { status: 200, headers: HTML_HEADERS },
      );
    }

    const { error } = await adminDb
      .from('digest_followers')
      .update({ is_active: false })
      .eq('id', followerId);

    if (error) throw error;

    return new Response(
      page(
        'Unsubscribed',
        childName
          ? `You will no longer receive weekly emails about ${childName}. The family can add you again from Settings if you change your mind.`
          : 'You will no longer receive weekly digest emails.',
      ),
      { status: 200, headers: HTML_HEADERS },
    );
  } catch (err) {
    console.error('[digest-unsubscribe] error:', err);
    return new Response(page('Something went wrong', 'Please try again later.'), {
      status: 500,
      headers: HTML_HEADERS,
    });
  }
});
