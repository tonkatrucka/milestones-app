/**
 * weekly-narrative edge function
 *
 * Called by a GitHub Actions cron every Sunday evening.
 * For every child with activity in the past 7 days, generates a warm
 * plain-language narrative of the week using Claude Haiku.
 *
 * The result is stored in child_insights.weekly_narrative.
 * Push notifications are sent to team members who have opted in
 * (using the existing push_tokens + notify-team infrastructure).
 */

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';
import { fetchRecentEvents, fetchMilestones, fetchMemories } from '../_shared/child-data.ts';
import { buildInsightDigest } from '../_shared/insight-stats.ts';
import { notifyTeamMembers } from '../_shared/notify-team.ts';
import { cronAuth } from '../_shared/cron-auth.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-client-info, apikey',
};

const NARRATIVE_SYSTEM = `You write warm, personal weekly summaries for parents tracking their baby's development.

Write 2–3 sentences in a warm, friendly tone — like a thoughtful friend recapping the week.
- Use the child's first name throughout.
- Mention 1–2 concrete things that happened (feeds, sleep, a milestone if any).
- Keep it encouraging and human. No medical advice.
- Return ONLY the narrative text — no JSON, no headings, no bullet points.`;

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

/** ISO week start (Monday) for a given date string. */
function weekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const authError = cronAuth(req);
  if (authError) {
    return new Response(JSON.stringify({ error: authError }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

    const adminDb = createClient(supabaseUrl, serviceRoleKey);
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const today = new Date().toISOString().split('T')[0];
    const thisWeekStart = weekStart(today);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Find all children with at least 1 event in the past 7 days
    const { data: activeChildren, error: childErr } = await adminDb
      .from('daily_events')
      .select('child_id')
      .gte('occurred_at', sevenDaysAgo.toISOString())
      .limit(500);

    if (childErr) throw new Error(`fetch active children: ${childErr.message}`);

    const uniqueChildIds = [...new Set((activeChildren ?? []).map((r: { child_id: string }) => r.child_id))];

    // Fetch child profiles for those IDs
    const { data: children } = await adminDb
      .from('children')
      .select('id, name, date_of_birth')
      .in('id', uniqueChildIds);

    let processed = 0;
    const errors: string[] = [];

    for (const child of children ?? []) {
      try {
        // Skip if we already generated a narrative this week
        const { data: existing } = await adminDb
          .from('child_insights')
          .select('weekly_narrative_week')
          .eq('child_id', child.id)
          .eq('insight_date', today)
          .maybeSingle();

        if (existing?.weekly_narrative_week === thisWeekStart) continue;

        const [events, milestones, memories] = await Promise.all([
          fetchRecentEvents(adminDb, child.id, 7),
          fetchMilestones(adminDb, child.id, { limit: 10 }),
          fetchMemories(adminDb, child.id, { limit: 5 }),
        ]);

        if (events.length === 0) continue;

        const digest = buildInsightDigest(
          child.name,
          child.date_of_birth,
          today,
          events,
          milestones,
          memories,
        );

        const age = calculateAge(child.date_of_birth, today);

        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 200,
          system: NARRATIVE_SYSTEM,
          messages: [
            {
              role: 'user',
              content: `Child: ${child.name} (${age})\n\n${digest.text}`,
            },
          ],
        });

        const block = response.content.find((b) => b.type === 'text');
        if (!block || block.type !== 'text') continue;

        const narrative = block.text.trim();

        // Upsert into child_insights (today's row)
        await adminDb.from('child_insights').upsert(
          {
            child_id: child.id,
            insight_date: today,
            weekly_narrative: narrative,
            weekly_narrative_week: thisWeekStart,
            categories: [],
            selected_research_by_region: {},
          },
          {
            onConflict: 'child_id,insight_date',
            ignoreDuplicates: false,
          },
        );

        // Send push notification to team members (fire-and-forget)
        notifyTeamMembers(adminDb, {
          childId: child.id,
          recordType: 'activity',
          createdByUserId: null,
          summary: `${child.name}'s weekly summary is ready`,
        }).catch(() => null);

        processed++;
      } catch (childErr) {
        errors.push(`${child.id}: ${childErr instanceof Error ? childErr.message : String(childErr)}`);
      }
    }

    return new Response(
      JSON.stringify({ processed, errors: errors.length > 0 ? errors : undefined }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  } catch (err) {
    console.error('[weekly-narrative] error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  }
});
