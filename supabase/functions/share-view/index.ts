/**
 * share-view edge function
 *
 * Renders a read-only, server-side HTML page for a shared milestone or memory.
 * Validates the share_links token, increments view_count, and returns styled HTML.
 * No JavaScript required in the rendered page.
 */

import { createClient } from 'npm:@supabase/supabase-js';

const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
};

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function ageAt(dob: string, eventDate: string): string {
  const birth = new Date(dob);
  const event = new Date(eventDate);
  const totalMonths =
    (event.getFullYear() - birth.getFullYear()) * 12 + (event.getMonth() - birth.getMonth());
  if (totalMonths < 1) return 'newborn';
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${totalMonths} month${totalMonths !== 1 ? 's' : ''} old`;
  if (months === 0) return `${years} year${years !== 1 ? 's' : ''} old`;
  return `${years}yr ${months}mo`;
}

function buildPage(params: {
  childName: string;
  childDob: string;
  type: 'milestone' | 'memory';
  title: string;
  description: string | null;
  date: string;
  tags?: string[];
  category?: string;
  photoUrls: string[];
}): string {
  const { childName, childDob, type, title, description, date, tags = [], category, photoUrls } = params;
  const age = ageAt(childDob, date);
  const dateLabel = formatDate(date);
  const accent = type === 'milestone' ? '#C4856A' : '#C9A8A0';

  const photosHtml = photoUrls.length > 0
    ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin:16px 0;">
        ${photoUrls.map((url) =>
          `<img src="${escHtml(url)}" alt="${escHtml(title)}" style="width:100%;max-width:400px;border-radius:12px;object-fit:cover;" />`
        ).join('')}
      </div>`
    : '';

  const descHtml = description
    ? `<p style="font-size:15px;line-height:1.6;color:#444;margin:12px 0;">${escHtml(description)}</p>`
    : '';

  const tagsHtml = tags.length > 0
    ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;">
        ${tags.map((t) => `<span style="background:#f0f0f0;border-radius:99px;padding:2px 10px;font-size:12px;color:#666;">${escHtml(t)}</span>`).join('')}
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escHtml(title)} — ${escHtml(childName)}</title>
<meta property="og:title" content="${escHtml(title)}"/>
<meta property="og:description" content="${escHtml(childName)} · ${escHtml(age)} · ${escHtml(dateLabel)}"/>
${photoUrls[0] ? `<meta property="og:image" content="${escHtml(photoUrls[0])}"/>` : ''}
</head>
<body style="margin:0;padding:0;background:#F0EBE3;font-family:-apple-system,Helvetica,Arial,sans-serif;min-height:100vh;">
<div style="max-width:480px;margin:0 auto;padding:24px 16px 48px;">

  <div style="text-align:center;margin-bottom:20px;">
    <div style="display:inline-block;background:${escHtml(accent)};color:#fff;border-radius:99px;padding:4px 14px;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">
      ${category ? escHtml(category) : escHtml(type)}
    </div>
  </div>

  <h1 style="font-size:26px;font-weight:800;text-align:center;color:#1a1a1a;margin:0 0 8px;">${escHtml(title)}</h1>
  <p style="text-align:center;color:#888;font-size:14px;margin:0 0 20px;">
    ${escHtml(childName)} · ${escHtml(age)} · ${escHtml(dateLabel)}
  </p>

  ${photosHtml}
  ${descHtml}
  ${tagsHtml}

  <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e0dcd6;text-align:center;">
    <p style="font-size:12px;color:#aaa;margin:0;">
      Captured with <strong>Milestones</strong> · Private family memory
    </p>
  </div>
</div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return new Response('Missing token', { status: 400, headers: HTML_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const adminDb = createClient(supabaseUrl, serviceRoleKey);

    const { data: link, error: linkErr } = await adminDb
      .from('share_links')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (linkErr || !link) {
      return new Response(buildErrorPage('Link not found'), { status: 404, headers: HTML_HEADERS });
    }
    if (link.revoked_at || new Date(link.expires_at) < new Date()) {
      return new Response(buildErrorPage('This link has expired'), { status: 410, headers: HTML_HEADERS });
    }
    if (link.view_count >= link.max_views) {
      return new Response(buildErrorPage('This link has reached its view limit'), { status: 410, headers: HTML_HEADERS });
    }

    // Increment view count
    await adminDb
      .from('share_links')
      .update({ view_count: link.view_count + 1 })
      .eq('id', link.id);

    // Fetch content
    const { data: child } = await adminDb
      .from('children')
      .select('name, date_of_birth')
      .eq('id', link.child_id)
      .maybeSingle();

    if (!child) {
      return new Response(buildErrorPage('Content not found'), { status: 404, headers: HTML_HEADERS });
    }

    let title = '', description = null, date = '', tags: string[] = [], category = '', mediaUrls: string[] = [];

    if (link.content_type === 'milestone') {
      const { data: m } = await adminDb
        .from('milestones')
        .select('title, description, achieved_at, category, media_urls, is_private')
        .eq('id', link.content_id)
        .maybeSingle();
      if (!m || m.is_private) {
        return new Response(buildErrorPage('Content not found'), { status: 404, headers: HTML_HEADERS });
      }
      title = m.title; description = m.description; date = m.achieved_at;
      category = m.category; mediaUrls = m.media_urls ?? [];
    } else {
      const { data: mem } = await adminDb
        .from('memories')
        .select('title, description, occurred_at, tags, media_urls, is_private')
        .eq('id', link.content_id)
        .maybeSingle();
      if (!mem || mem.is_private) {
        return new Response(buildErrorPage('Content not found'), { status: 404, headers: HTML_HEADERS });
      }
      title = mem.title; description = mem.description; date = mem.occurred_at;
      tags = mem.tags ?? []; mediaUrls = mem.media_urls ?? [];
    }

    // Generate short-lived signed URLs for photos
    const signedPhotoUrls: string[] = [];
    for (const path of mediaUrls.slice(0, 5)) {
      const { data: signed } = await adminDb.storage
        .from('milestone-media')
        .createSignedUrl(path, 3600);
      if (signed?.signedUrl) signedPhotoUrls.push(signed.signedUrl);
    }

    const html = buildPage({
      childName: child.name,
      childDob: child.date_of_birth,
      type: link.content_type,
      title,
      description,
      date,
      tags,
      category,
      photoUrls: signedPhotoUrls,
    });

    return new Response(html, { status: 200, headers: HTML_HEADERS });
  } catch (err) {
    console.error('[share-view] error:', err);
    return new Response(buildErrorPage('Something went wrong'), { status: 500, headers: HTML_HEADERS });
  }
});

function buildErrorPage(message: string): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px;">
<h2>🔒 ${escHtml(message)}</h2>
<p>This link may have expired or been revoked by the owner.</p>
</body></html>`;
}
