/**
 * digest-send edge function
 *
 * Sends the weekly/monthly email digest to all active digest_followers.
 * Called by a GitHub Actions cron (Sunday 7pm UTC, same window as weekly-narrative).
 *
 * Uses Resend for email delivery. Requires RESEND_API_KEY secret.
 * If RESEND_API_KEY is not set, logs what would be sent (dry-run mode).
 *
 * Each reaction link embeds a signed JWT (HMAC-SHA256 with DIGEST_SECRET).
 */

import { createClient } from 'npm:@supabase/supabase-js';
import { cronAuth } from '../_shared/cron-auth.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-client-info, apikey',
};

// ─── JWT signing ──────────────────────────────────────────────────────────────

async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  ttlSeconds = 48 * 3600,
): Promise<string> {
  const encoder = new TextEncoder();
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }));
  const sigInput = `${header}.${body}`;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(sigInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${sigInput}.${sigB64}`;
}

// ─── HTML email builder ───────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildReactionButtons(
  contentId: string,
  contentType: string,
  childId: string,
  reactorEmail: string,
  jwt: string,
  supabaseUrl: string,
): string {
  const emojis = ['❤️', '🥹', '😍', '👏', '🎉'];
  const buttons = emojis.map((emoji) => {
    const encodedEmoji = encodeURIComponent(emoji);
    const url = `${supabaseUrl}/functions/v1/digest-react?token=${encodeURIComponent(jwt)}&emoji=${encodedEmoji}`;
    return `<a href="${esc(url)}" style="display:inline-block;text-decoration:none;font-size:22px;padding:4px 8px;border-radius:8px;border:1px solid #e0dcd6;background:#fff;margin:2px;">${emoji}</a>`;
  }).join('');
  return `<div style="margin:8px 0;">${buttons}</div>`;
}

function buildEmail(params: {
  childName: string;
  childDob: string;
  followerName: string | null;
  milestones: Array<{ title: string; category: string; achieved_at: string; id: string; photoUrl?: string; jwt: string }>;
  memories: Array<{ title: string; occurred_at: string; id: string; photoUrl?: string; jwt: string }>;
  supabaseUrl: string;
  childId: string;
  reactorEmail: string;
  unsubscribeUrl: string;
}): string {
  const {
    childName, followerName, milestones, memories,
    supabaseUrl, childId, reactorEmail, unsubscribeUrl,
  } = params;

  const greeting = followerName ? `Hi ${esc(followerName)},` : 'Hi,';

  const milestoneBlocks = milestones.map((m) => `
    <div style="margin-bottom:20px;background:#fff;border-radius:12px;padding:16px;border:1px solid #e0dcd6;">
      <div style="font-size:11px;font-weight:700;color:#C4856A;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:4px;">${esc(m.category)} milestone</div>
      <div style="font-size:18px;font-weight:800;color:#1a1a1a;margin-bottom:4px;">${esc(m.title)}</div>
      <div style="font-size:12px;color:#888;margin-bottom:12px;">${new Date(m.achieved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      ${m.photoUrl ? `<img src="${esc(m.photoUrl)}" alt="${esc(m.title)}" style="width:100%;max-width:360px;border-radius:8px;display:block;margin-bottom:12px;" />` : ''}
      ${buildReactionButtons(m.id, 'milestone', childId, reactorEmail, m.jwt, supabaseUrl)}
    </div>
  `).join('');

  const memoryBlocks = memories.map((mem) => `
    <div style="margin-bottom:20px;background:#fff;border-radius:12px;padding:16px;border:1px solid #e0dcd6;">
      <div style="font-size:11px;font-weight:700;color:#C9A8A0;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:4px;">Memory</div>
      <div style="font-size:18px;font-weight:800;color:#1a1a1a;margin-bottom:4px;">${esc(mem.title)}</div>
      <div style="font-size:12px;color:#888;margin-bottom:12px;">${new Date(mem.occurred_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      ${mem.photoUrl ? `<img src="${esc(mem.photoUrl)}" alt="${esc(mem.title)}" style="width:100%;max-width:360px;border-radius:8px;display:block;margin-bottom:12px;" />` : ''}
      ${buildReactionButtons(mem.id, 'memory', childId, reactorEmail, mem.jwt, supabaseUrl)}
    </div>
  `).join('');

  const noContent = milestones.length === 0 && memories.length === 0;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#F0EBE3;font-family:-apple-system,Helvetica,Arial,sans-serif;">
<div style="max-width:480px;margin:0 auto;padding:24px 16px;">
  <h2 style="font-size:22px;font-weight:800;color:#1a1a1a;margin:0 0 4px;">${esc(childName)}&apos;s week</h2>
  <p style="color:#888;font-size:14px;margin:0 0 24px;">${greeting}</p>

  ${noContent ? `<p style="color:#666;font-size:15px;">No new milestones or memories this week — check back next Sunday.</p>` : ''}
  ${milestoneBlocks}
  ${memoryBlocks}

  <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e0dcd6;font-size:11px;color:#aaa;text-align:center;">
    <p>You receive this because someone added you to ${esc(childName)}&apos;s Milestones.</p>
    <p><a href="${esc(unsubscribeUrl)}" style="color:#aaa;">Unsubscribe</a></p>
  </div>
</div>
</body>
</html>`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  const authError = cronAuth(req);
  if (authError) {
    return new Response(JSON.stringify({ error: authError }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const digestSecret = Deno.env.get('DIGEST_SECRET') ?? 'dev-secret';
    const fromEmail = Deno.env.get('DIGEST_FROM_EMAIL') ?? 'updates@milestones.app';

    const adminDb = createClient(supabaseUrl, serviceRoleKey);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const since = sevenDaysAgo.toISOString().split('T')[0];

    // Get all active weekly followers
    const { data: followers } = await adminDb
      .from('digest_followers')
      .select('*, children(id, name, date_of_birth)')
      .eq('is_active', true)
      .eq('frequency', 'weekly');

    let sent = 0;
    const errors: string[] = [];

    for (const follower of followers ?? []) {
      try {
        // deno-lint-ignore no-explicit-any
        const child = (follower as any).children;
        if (!child) continue;

        const contentFilter = follower.content_filter;

        // Fetch new milestones
        let milestoneQuery = adminDb
          .from('milestones')
          .select('id, title, category, achieved_at, media_urls, is_private')
          .eq('child_id', child.id)
          .eq('is_private', false)
          .gte('achieved_at', since)
          .order('achieved_at', { ascending: false })
          .limit(5);

        const { data: rawMilestones } = await milestoneQuery;

        // Fetch new memories (unless milestones_only filter)
        const { data: rawMemories } = contentFilter === 'milestones_only'
          ? { data: [] }
          : await adminDb
              .from('memories')
              .select('id, title, occurred_at, media_urls, is_private')
              .eq('child_id', child.id)
              .eq('is_private', false)
              .gte('occurred_at', since)
              .order('occurred_at', { ascending: false })
              .limit(3);

        // Generate signed URLs for first photo of each item
        const withPhoto = async (
          item: { id: string; media_urls: string[] },
        ): Promise<string | undefined> => {
          if (contentFilter === 'no_photos' || !item.media_urls?.[0]) return undefined;
          const { data } = await adminDb.storage
            .from('milestone-media')
            .createSignedUrl(item.media_urls[0], 48 * 3600);
          return data?.signedUrl;
        };

        const milestones = await Promise.all(
          (rawMilestones ?? []).map(async (m: { id: string; title: string; category: string; achieved_at: string; media_urls: string[] }) => {
            const jwt = await signJwt({ childId: child.id, contentId: m.id, contentType: 'milestone', reactorEmail: follower.email }, digestSecret);
            return { ...m, photoUrl: await withPhoto(m), jwt };
          }),
        );

        const memories = await Promise.all(
          (rawMemories ?? []).map(async (mem: { id: string; title: string; occurred_at: string; media_urls: string[] }) => {
            const jwt = await signJwt({ childId: child.id, contentId: mem.id, contentType: 'memory', reactorEmail: follower.email }, digestSecret);
            return { ...mem, photoUrl: await withPhoto(mem), jwt };
          }),
        );

        if (milestones.length === 0 && memories.length === 0) continue;

        const unsubToken = await signJwt(
          { purpose: 'unsubscribe', followerId: follower.id },
          digestSecret,
          365 * 24 * 3600,
        );
        const unsubscribeUrl = `${supabaseUrl}/functions/v1/digest-unsubscribe?token=${encodeURIComponent(unsubToken)}`;

        const html = buildEmail({
          childName: child.name,
          childDob: child.date_of_birth,
          followerName: follower.display_name,
          milestones,
          memories,
          supabaseUrl,
          childId: child.id,
          reactorEmail: follower.email,
          unsubscribeUrl,
        });

        if (resendApiKey) {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: fromEmail,
              to: follower.email,
              subject: `${child.name}'s week on Milestones`,
              html,
            }),
          });
          if (!response.ok) {
            errors.push(`${follower.email}: ${response.statusText}`);
            continue;
          }
        } else {
          console.log(`[digest-send] DRY RUN: would send to ${follower.email} for ${child.name}`);
        }

        sent++;
      } catch (err) {
        errors.push(`${follower.email}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return new Response(
      JSON.stringify({ sent, errors: errors.length > 0 ? errors : undefined }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  } catch (err) {
    console.error('[digest-send] error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  }
});
