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
 *
 * Monthly recaps are rewritten on the same Sunday cadence for the current
 * month. On the first Sunday of a new month the previous month is rewritten
 * once more so the closed month includes its final days.
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

const MONTHLY_RECAP_SYSTEM = `You write beautiful, keepsake-quality monthly recaps for parents about their baby's journey.

Write 2–3 warm, personal sentences that feel like a love letter to the month — something the parent will want to read again in years to come.
- Use the child's first name throughout.
- Focus on Journey content: milestones achieved and memories captured. Not on feeding/nappy counts.
- Be specific — mention actual milestone titles or memory moments if available.
- The tone is warm, present, and personal — like a thoughtful family member writing in a baby book.
- Return ONLY the narrative text — no JSON, no headings, no bullet points.`;

// deno-lint-ignore no-explicit-any
type AdminDb = any;

/** ISO month key 'YYYY-MM' for a given date string */
function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** Previous calendar month key */
function previousMonthKey(today: string): string {
  const d = new Date(today);
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
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

/** ISO week start (Monday) for a given date string. */
function weekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function monthRange(monthKeyStr: string, today: string): { start: string; end: string } {
  const start = `${monthKeyStr}-01`;
  const endDate = new Date(`${monthKeyStr}-01`);
  endDate.setMonth(endDate.getMonth() + 1);
  endDate.setDate(0);
  const monthEnd = endDate.toISOString().split('T')[0];
  return { start, end: monthEnd < today ? monthEnd : today };
}

function isFirstSundayOfMonth(today: string): boolean {
  return Number(today.slice(8, 10)) <= 7;
}

async function childIdsWithJourneyInMonth(
  adminDb: AdminDb,
  monthKeyStr: string,
  today: string,
): Promise<string[]> {
  const { start, end } = monthRange(monthKeyStr, today);
  const [{ data: monthMilestones }, { data: monthMemories }] = await Promise.all([
    adminDb
      .from('milestones')
      .select('child_id')
      .gte('achieved_at', start)
      .lte('achieved_at', end)
      .limit(500),
    adminDb
      .from('memories')
      .select('child_id')
      .gte('occurred_at', start)
      .lte('occurred_at', end)
      .limit(500),
  ]);
  return [
    ...(monthMilestones ?? []).map((r: { child_id: string }) => r.child_id),
    ...(monthMemories ?? []).map((r: { child_id: string }) => r.child_id),
  ];
}

async function writeMonthlyRecap(
  adminDb: AdminDb,
  anthropic: Anthropic,
  child: { id: string; name: string },
  age: string,
  monthKeyStr: string,
  today: string,
): Promise<boolean> {
  const { start, end } = monthRange(monthKeyStr, today);
  const [{ data: monthMilestones }, { data: monthMemories }] = await Promise.all([
    adminDb
      .from('milestones')
      .select('title, category, achieved_at')
      .eq('child_id', child.id)
      .gte('achieved_at', start)
      .lte('achieved_at', end),
    adminDb
      .from('memories')
      .select('title, occurred_at')
      .eq('child_id', child.id)
      .gte('occurred_at', start)
      .lte('occurred_at', end),
  ]);

  if ((monthMilestones?.length ?? 0) === 0 && (monthMemories?.length ?? 0) === 0) {
    return false;
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
    system: MONTHLY_RECAP_SYSTEM,
    messages: [{ role: 'user', content: `Child: ${child.name} (${age})\n${recapPrompt}` }],
  });
  const recapBlock = recapResponse.content.find((b) => b.type === 'text');
  if (!recapBlock || recapBlock.type !== 'text') return false;

  await adminDb.from('monthly_recaps').upsert(
    { child_id: child.id, month_key: monthKeyStr, narrative: recapBlock.text.trim() },
    { onConflict: 'child_id,month_key', ignoreDuplicates: false },
  );
  return true;
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
    const thisMonth = monthKey(today);
    const prevMonth = previousMonthKey(today);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: activeChildren, error: childErr } = await adminDb
      .from('daily_events')
      .select('child_id')
      .gte('occurred_at', sevenDaysAgo.toISOString())
      .limit(500);

    if (childErr) throw new Error(`fetch active children: ${childErr.message}`);

    const journeyMonths = [thisMonth];
    if (isFirstSundayOfMonth(today)) journeyMonths.push(prevMonth);

    const journeyIds = (
      await Promise.all(journeyMonths.map((key) => childIdsWithJourneyInMonth(adminDb, key, today)))
    ).flat();

    const uniqueChildIds = [
      ...new Set([
        ...(activeChildren ?? []).map((r: { child_id: string }) => r.child_id),
        ...journeyIds,
      ]),
    ];

    if (uniqueChildIds.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const { data: children } = await adminDb
      .from('children')
      .select('id, name, date_of_birth')
      .in('id', uniqueChildIds);

    let processed = 0;
    const errors: string[] = [];

    for (const child of children ?? []) {
      try {
        const age = calculateAge(child.date_of_birth, today);
        let wrote = false;

        const { data: existing } = await adminDb
          .from('child_insights')
          .select('weekly_narrative_week')
          .eq('child_id', child.id)
          .eq('insight_date', today)
          .maybeSingle();

        if (existing?.weekly_narrative_week !== thisWeekStart) {
          const [events, milestones, memories] = await Promise.all([
            fetchRecentEvents(adminDb, child.id, 7),
            fetchMilestones(adminDb, child.id, { limit: 10 }),
            fetchMemories(adminDb, child.id, { limit: 5 }),
          ]);

          if (events.length > 0) {
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
              system: NARRATIVE_SYSTEM,
              messages: [
                {
                  role: 'user',
                  content: `Child: ${child.name} (${age})\n\n${digest.text}`,
                },
              ],
            });

            const block = response.content.find((b) => b.type === 'text');
            if (block && block.type === 'text') {
              const narrative = block.text.trim();
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

              notifyTeamMembers(adminDb, {
                childId: child.id,
                recordType: 'activity',
                createdByUserId: null,
                summary: `${child.name}'s weekly summary is ready`,
              }).catch(() => null);

              wrote = true;
            }
          }
        }

        try {
          if (await writeMonthlyRecap(adminDb, anthropic, child, age, thisMonth, today)) {
            wrote = true;
          }
          if (isFirstSundayOfMonth(today)) {
            if (await writeMonthlyRecap(adminDb, anthropic, child, age, prevMonth, today)) {
              wrote = true;
            }
          }
        } catch {
          /* monthly recap failure is non-blocking */
        }

        if (wrote) processed++;
      } catch (loopErr) {
        errors.push(`${child.id}: ${loopErr instanceof Error ? loopErr.message : String(loopErr)}`);
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
