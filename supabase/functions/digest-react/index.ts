/**
 * digest-react edge function
 *
 * Handles one-tap emoji reactions from email digest links.
 * Validates a signed JWT embedded in the link, records the reaction,
 * then redirects to a friendly "Thank you" page.
 *
 * No JavaScript required — works from any email client.
 */

import { createClient } from 'npm:@supabase/supabase-js';

const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'no-store',
};

/** Minimal JWT verification without a full JWT library. */
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
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, sigInput);
    if (!valid) return null;

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function thankYouPage(emoji: string, childName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Reaction sent!</title>
</head>
<body style="margin:0;background:#F0EBE3;font-family:-apple-system,Helvetica,Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
<div style="text-align:center;padding:32px;">
  <div style="font-size:64px;margin-bottom:16px;">${emoji}</div>
  <h2 style="color:#1a1a1a;margin:0 0 8px;">Reaction sent!</h2>
  <p style="color:#666;font-size:15px;">${childName}'s family will see your ${emoji}.</p>
</div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const url = new URL(req.url);
  const jwtToken = url.searchParams.get('token');
  const emoji = decodeURIComponent(url.searchParams.get('emoji') ?? '');

  if (!jwtToken || !emoji) {
    return new Response('Missing parameters', { status: 400 });
  }

  const digestSecret = Deno.env.get('DIGEST_SECRET') ?? '';
  if (!digestSecret) {
    return new Response('Server configuration error', { status: 500 });
  }

  const payload = await verifyJwt(jwtToken, digestSecret);
  if (!payload) {
    return new Response('Invalid or expired link', { status: 401, headers: HTML_HEADERS });
  }

  const { childId, contentId, contentType, reactorEmail } = payload as {
    childId: string;
    contentId: string;
    contentType: string;
    reactorEmail: string;
  };

  if (!childId || !contentId || !reactorEmail) {
    return new Response('Invalid token payload', { status: 400 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const adminDb = createClient(supabaseUrl, serviceRoleKey);

    // Rate limit: one reaction per email per content per day
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await adminDb
      .from('digest_reactions')
      .select('id, reacted_at')
      .eq('content_id', contentId)
      .eq('reactor_email', reactorEmail)
      .gte('reacted_at', `${today}T00:00:00`)
      .maybeSingle();

    if (!existing) {
      await adminDb.from('digest_reactions').upsert({
        content_id: contentId,
        content_type: contentType,
        reactor_email: reactorEmail,
        emoji,
        reacted_at: new Date().toISOString(),
      });
    }

    // Get child name for the thank-you page
    const { data: child } = await adminDb
      .from('children')
      .select('name')
      .eq('id', childId)
      .maybeSingle();

    const childName = child?.name ?? 'your baby';
    return new Response(thankYouPage(emoji, childName), { status: 200, headers: HTML_HEADERS });
  } catch (err) {
    console.error('[digest-react] error:', err);
    return new Response('Something went wrong', { status: 500 });
  }
});
