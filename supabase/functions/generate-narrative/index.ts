/**
 * generate-narrative edge function
 *
 * User-initiated weekly or monthly story. Stores the result so Journal and
 * Explore can show it without waiting for the Sunday cron.
 */

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';
import { fetchRecentEvents, fetchMilestones, fetchMemories } from '../_shared/child-data.ts';
import { buildInsightDigest } from '../_shared/insight-stats.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-client-info, apikey',
};

const WEEKLY_SYSTEM = `You write warm, personal weekly summaries for parents tracking their baby's development.

Write 2–3 sentences in a warm, friendly tone — like a thoughtful friend recapping the week.
- Use the child's first name throughout.
- Mention 1–2 concrete things that happened (feeds, naps, a milestone if any).
- Keep it encouraging and human. No medical advice.
- Return ONLY the narrative text — no JSON, no headings, no bullet points.`;

const MONTHLY_SYSTEM = `You write beautiful, keepsake-quality monthly recaps for parents about their baby's journey.

Write 2–3 warm, personal sentences that feel like a love letter to the month — something the parent will want to read again in years to come.
- Use the child's first name throughout.
- Focus on Journey content: milestones achieved and memories captured. Not on feeding/nappy counts.
- Be specific — mention actual milestone titles or memory moments if available.
- The tone is warm, present, and personal — like a thoughtful family member writing in a baby book.
- Return ONLY the narrative text — no JSON, no headings, no bullet points.`;

function weekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function calculateAge(dob: string, today: string): string {
  const birth = new Date(dob);
  const now = new Date(today);
  const totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (totalMonths < 1) return 'a newborn';
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${totalMonths} month${totalMonths !== 1 ? 's' : ''} old`;
  if (months === 0) return `${years} year${years !== 1 ? 's' : ''} old`;
  return `${years} year${years !== 1 ? 's' : ''} and ${months} month${months !== 1 ? 's' : ''} old`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

    const authHeader = req.headers.get('Authorization') ?? '';
    const userDb = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userDb.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const body = await req.json();
    const childId = body?.childId as string | undefined;
    const kind = body?.kind as 'weekly' | 'monthly' | undefined;
    if (!childId || (kind !== 'weekly' && kind !== 'monthly')) {
      return new Response(JSON.stringify({ error: 'childId and kind are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const { data: membership } = await userDb
      .from('child_members')
      .select('role')
      .eq('child_id', childId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const adminDb = createClient(supabaseUrl, serviceRoleKey);
    const { data: child } = await adminDb
      .from('children')
      .select('id, name, date_of_birth')
      .eq('id', childId)
      .maybeSingle();
    if (!child) {
      return new Response(JSON.stringify({ error: 'Child not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const age = calculateAge(child.date_of_birth, today);
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    if (kind === 'weekly') {
      const [events, milestones, memories] = await Promise.all([
        fetchRecentEvents(adminDb, child.id, 7),
        fetchMilestones(adminDb, child.id, { limit: 10 }),
        fetchMemories(adminDb, child.id, { limit: 5 }),
      ]);
      const digest = buildInsightDigest(
        child.name,
        child.date_of_birth,
        today,
        events,
        milestones,
        memories,
      );
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 200,
        system: WEEKLY_SYSTEM,
        messages: [{ role: 'user', content: `Child: ${child.name} (${age})\n\n${digest.text}` }],
      });
      const block = response.content.find((b) => b.type === 'text');
      if (!block || block.type !== 'text') {
        throw new Error('No narrative returned');
      }
      const narrative = block.text.trim();
      await adminDb.from('child_insights').upsert(
        {
          child_id: child.id,
          insight_date: today,
          weekly_narrative: narrative,
          weekly_narrative_week: weekStart(today),
          categories: [],
          selected_research_by_region: {},
        },
        { onConflict: 'child_id,insight_date', ignoreDuplicates: false },
      );
      return new Response(JSON.stringify({ narrative, kind: 'weekly' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const monthKey = today.slice(0, 7);
    const monthStart = `${monthKey}-01`;
    const [{ data: monthMilestones }, { data: monthMemories }] = await Promise.all([
      adminDb
        .from('milestones')
        .select('title, category, achieved_at')
        .eq('child_id', child.id)
        .gte('achieved_at', monthStart)
        .lte('achieved_at', today),
      adminDb
        .from('memories')
        .select('title, occurred_at')
        .eq('child_id', child.id)
        .gte('occurred_at', monthStart)
        .lte('occurred_at', today),
    ]);

    if ((monthMilestones?.length ?? 0) === 0 && (monthMemories?.length ?? 0) === 0) {
      return new Response(
        JSON.stringify({ error: 'Add a milestone or memory this month first.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
      );
    }

    const milestoneList = (monthMilestones ?? [])
      .map((m: { title: string; category: string }) => `${m.category}: ${m.title}`)
      .join('; ');
    const memoryList = (monthMemories ?? []).map((m: { title: string }) => m.title).join('; ');
    const recapPrompt = [
      milestoneList ? `Milestones this month: ${milestoneList}.` : '',
      memoryList ? `Memories captured: ${memoryList}.` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const recapResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      system: MONTHLY_SYSTEM,
      messages: [{ role: 'user', content: `Child: ${child.name} (${age})\n${recapPrompt}` }],
    });
    const recapBlock = recapResponse.content.find((b) => b.type === 'text');
    if (!recapBlock || recapBlock.type !== 'text') {
      throw new Error('No recap returned');
    }
    const narrative = recapBlock.text.trim();
    await adminDb.from('monthly_recaps').upsert(
      { child_id: child.id, month_key: monthKey, narrative },
      { onConflict: 'child_id,month_key', ignoreDuplicates: false },
    );
    return new Response(JSON.stringify({ narrative, kind: 'monthly', monthKey }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (err) {
    console.error('[generate-narrative] error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  }
});
