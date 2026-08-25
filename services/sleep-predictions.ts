/**
 * Client-side sleep pattern analysis and nap window prediction.
 * Pure maths — no LLM, no API cost. Works offline.
 */

import { supabase } from '@/lib/supabase';
import type { DailyEvent, SleepPrediction, SleepMetadata } from '@/lib/database.types';

export interface WakeWindow {
  durationMins: number;
  hour: number; // hour of day the wake window started
}

export interface NapPrediction {
  nextNapStart: Date;
  nextNapEnd: Date;
  wakeWindowMins: number;
  avgNapMins: number;
  confidence: number; // 0-100
  dataDays: number;
}

/** Minimum days of sleep data required before we show predictions. */
export const MIN_DATA_DAYS = 5;

/**
 * Analyses sleep events from the last N days and returns a prediction
 * for the next nap window. Returns null if insufficient data.
 */
export function analyseSleepPatterns(events: DailyEvent[]): NapPrediction | null {
  const sleepEvents = events
    .filter((e) => e.type === 'sleep')
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

  if (sleepEvents.length < 3) return null;

  // Calculate completed nap durations
  const napDurations: number[] = [];
  const wakeWindows: number[] = [];

  for (let i = 0; i < sleepEvents.length; i++) {
    const ev = sleepEvents[i];
    const meta = ev.metadata as Partial<SleepMetadata>;
    if (!meta.sleepEnd) continue;

    const napStart = new Date(ev.occurred_at);
    const napEnd = new Date(meta.sleepEnd);
    const napMins = (napEnd.getTime() - napStart.getTime()) / 60000;
    if (napMins >= 5 && napMins <= 480) {
      napDurations.push(napMins);
    }

    // Wake window = time from this nap's end to the next nap's start
    const nextNap = sleepEvents.slice(i + 1).find((n) => true);
    if (nextNap) {
      const wakeStart = napEnd;
      const nextSleepStart = new Date(nextNap.occurred_at);
      const wakeMinutes = (nextSleepStart.getTime() - wakeStart.getTime()) / 60000;
      if (wakeMinutes >= 30 && wakeMinutes <= 360) {
        wakeWindows.push(wakeMinutes);
      }
    }
  }

  if (napDurations.length < 2 || wakeWindows.length < 2) return null;

  // Count distinct days in the dataset
  const distinctDays = new Set(
    sleepEvents.map((e) => new Date(e.occurred_at).toDateString()),
  ).size;

  if (distinctDays < MIN_DATA_DAYS) return null;

  const avgNapMins = Math.round(napDurations.reduce((a, b) => a + b, 0) / napDurations.length);
  const avgWakeWindowMins = Math.round(wakeWindows.reduce((a, b) => a + b, 0) / wakeWindows.length);

  // Find the last completed or ongoing sleep event
  const lastSleep = sleepEvents[sleepEvents.length - 1];
  const lastMeta = lastSleep.metadata as Partial<SleepMetadata>;
  const lastWakeTime = lastMeta.sleepEnd ? new Date(lastMeta.sleepEnd) : null;
  if (!lastWakeTime) return null;

  const nextNapStart = new Date(lastWakeTime.getTime() + avgWakeWindowMins * 60000);
  const nextNapEnd = new Date(nextNapStart.getTime() + avgNapMins * 60000);

  // Confidence: higher with more data, lower if high variance
  const variance = napDurations.reduce((acc, d) => acc + (d - avgNapMins) ** 2, 0) / napDurations.length;
  const cv = Math.sqrt(variance) / avgNapMins; // coefficient of variation
  const confidenceRaw = Math.min(100, Math.max(30, Math.round(90 - cv * 50 + Math.min(distinctDays, 14) * 2)));

  return {
    nextNapStart,
    nextNapEnd,
    wakeWindowMins: avgWakeWindowMins,
    avgNapMins,
    confidence: confidenceRaw,
    dataDays: distinctDays,
  };
}

/** Fetch cached prediction from the database. */
export async function getCachedSleepPrediction(
  childId: string,
): Promise<SleepPrediction | null> {
  const { data, error } = await supabase
    .from('child_sleep_predictions')
    .select('*')
    .eq('child_id', childId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
