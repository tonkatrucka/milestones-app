/**
 * sleep-predictions edge function
 *
 * Called by a GitHub Actions cron each morning.
 * For every active child with ≥5 days of sleep data, calculates
 * nap window predictions and stores them in child_sleep_predictions.
 *
 * Pure maths — no LLM calls. Zero AI cost.
 */

import { createClient } from 'npm:@supabase/supabase-js';
import { cronAuth } from '../_shared/cron-auth.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-client-info, apikey',
};

const MIN_DATA_DAYS = 5;

interface SleepEvent {
  id: string;
  child_id: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
}

function analyseSleep(events: SleepEvent[]): {
  wakeWindowMins: number | null;
  nextNapStart: string | null;
  nextNapEnd: string | null;
  avgNapMins: number | null;
  confidence: number;
  dataDays: number;
} | null {
  const sleepEvents = events
    .filter((e) => e.metadata && !e.metadata.sleepEnd === false || (e.metadata as Record<string, unknown>).sleepEnd)
    .concat(events.filter((e) => !(e.metadata as Record<string, unknown>).sleepEnd))
    .filter((_, i, arr) => arr.findIndex((x) => x.id === events[i]?.id) === i);

  const sorted = [...events]
    .filter((e) => true)
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

  if (sorted.length < 3) return null;

  const napDurations: number[] = [];
  const wakeWindows: number[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    const meta = ev.metadata as { sleepEnd?: string };
    if (!meta.sleepEnd) continue;

    const napStart = new Date(ev.occurred_at);
    const napEnd = new Date(meta.sleepEnd);
    const napMins = (napEnd.getTime() - napStart.getTime()) / 60000;
    if (napMins >= 5 && napMins <= 480) napDurations.push(napMins);

    const nextNap = sorted.slice(i + 1).find(() => true);
    if (nextNap) {
      const wakeMin = (new Date(nextNap.occurred_at).getTime() - napEnd.getTime()) / 60000;
      if (wakeMin >= 30 && wakeMin <= 360) wakeWindows.push(wakeMin);
    }
  }

  const distinctDays = new Set(sorted.map((e) => new Date(e.occurred_at).toDateString())).size;
  if (distinctDays < MIN_DATA_DAYS || napDurations.length < 2 || wakeWindows.length < 2) return null;

  const avgNapMins = Math.round(napDurations.reduce((a, b) => a + b, 0) / napDurations.length);
  const avgWake = Math.round(wakeWindows.reduce((a, b) => a + b, 0) / wakeWindows.length);

  // Last completed sleep
  const lastCompleted = [...sorted].reverse().find((e) => !!(e.metadata as { sleepEnd?: string }).sleepEnd);
  if (!lastCompleted) return null;

  const lastWakeStr = (lastCompleted.metadata as { sleepEnd: string }).sleepEnd;
  const lastWake = new Date(lastWakeStr);
  const nextNapStart = new Date(lastWake.getTime() + avgWake * 60000);
  const nextNapEnd = new Date(nextNapStart.getTime() + avgNapMins * 60000);

  const variance = napDurations.reduce((acc, d) => acc + (d - avgNapMins) ** 2, 0) / napDurations.length;
  const cv = Math.sqrt(variance) / avgNapMins;
  const confidence = Math.min(100, Math.max(30, Math.round(90 - cv * 50 + Math.min(distinctDays, 14) * 2)));

  return {
    wakeWindowMins: avgWake,
    nextNapStart: nextNapStart.toISOString(),
    nextNapEnd: nextNapEnd.toISOString(),
    avgNapMins,
    confidence,
    dataDays: distinctDays,
  };
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
    const adminDb = createClient(supabaseUrl, serviceRoleKey);

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data: recentSleep, error: sleepErr } = await adminDb
      .from('daily_events')
      .select('id, child_id, occurred_at, metadata')
      .eq('type', 'sleep')
      .gte('occurred_at', since.toISOString())
      .order('occurred_at', { ascending: true });

    if (sleepErr) throw new Error(`fetch sleep: ${sleepErr.message}`);

    // Group by child
    const byChild = new Map<string, SleepEvent[]>();
    for (const ev of recentSleep ?? []) {
      if (!byChild.has(ev.child_id)) byChild.set(ev.child_id, []);
      byChild.get(ev.child_id)!.push(ev as SleepEvent);
    }

    let processed = 0;
    const errors: string[] = [];

    for (const [childId, events] of byChild) {
      try {
        const result = analyseSleep(events);
        if (!result) continue;

        await adminDb.from('child_sleep_predictions').upsert(
          {
            child_id: childId,
            generated_date: new Date().toISOString().split('T')[0],
            wake_window_mins: result.wakeWindowMins,
            next_nap_start: result.nextNapStart,
            next_nap_end: result.nextNapEnd,
            avg_nap_mins: result.avgNapMins,
            confidence: result.confidence,
            data_days: result.dataDays,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'child_id' },
        );
        processed++;
      } catch (err) {
        errors.push(`${childId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return new Response(
      JSON.stringify({ processed, errors: errors.length > 0 ? errors : undefined }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  } catch (err) {
    console.error('[sleep-predictions] error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  }
});
