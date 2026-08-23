/**
 * Caregiver handoff summary — pure client-side, no API cost.
 * Generates a natural-language brief from recent logged events.
 */

import { differenceInMinutes, formatDistanceToNow } from 'date-fns';
import type { DailyEvent, SleepMetadata, MealMetadata, NappyMetadata, PumpMetadata, TemperatureMetadata, MedicationMetadata } from '@/lib/database.types';

export interface HandoffSummary {
  lines: string[];
  generatedAt: Date;
  sinceHours: number;
}

/**
 * Build a plain-English handoff brief from recent events.
 * @param events  All events from the last `sinceHours` hours, newest-first.
 * @param childName  The child's first name.
 * @param sinceHours  How far back to summarise (default 4h).
 */
export function buildHandoffSummary(
  events: DailyEvent[],
  childName: string,
  sinceHours = 4,
): HandoffSummary {
  const cutoff = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const recent = events.filter((e) => new Date(e.occurred_at) >= cutoff);

  if (recent.length === 0) {
    return {
      lines: [`Nothing logged for ${childName} in the last ${sinceHours} hours.`],
      generatedAt: new Date(),
      sinceHours,
    };
  }

  const lines: string[] = [];

  // Sleep status — look for ongoing sleep first
  const openSleep = recent.find((e) => {
    if (e.type !== 'sleep') return false;
    const m = e.metadata as Partial<SleepMetadata>;
    return !m.sleepEnd;
  });

  if (openSleep) {
    const elapsed = Math.round(differenceInMinutes(new Date(), new Date(openSleep.occurred_at)));
    const dur = elapsed >= 60 ? `${Math.floor(elapsed / 60)}h ${elapsed % 60}m` : `${elapsed}m`;
    lines.push(`😴 Currently asleep — ${dur} into nap (started ${formatDistanceToNow(new Date(openSleep.occurred_at), { addSuffix: true })}).`);
  } else {
    const lastSleep = recent.find((e) => e.type === 'sleep');
    if (lastSleep) {
      const m = lastSleep.metadata as Partial<SleepMetadata>;
      if (m.sleepEnd) {
        const napMins = Math.round(differenceInMinutes(new Date(m.sleepEnd), new Date(lastSleep.occurred_at)));
        const label = napMins >= 60 ? `${Math.floor(napMins / 60)}h ${napMins % 60}m` : `${napMins}m`;
        lines.push(`😴 Last nap: ${label} (woke ${formatDistanceToNow(new Date(m.sleepEnd), { addSuffix: true })}).`);
      }
    }
  }

  // Last feed
  const lastMeal = recent.find((e) => e.type === 'meal');
  if (lastMeal) {
    const m = lastMeal.metadata as Partial<MealMetadata>;
    const parts: string[] = [];
    if (m.mealType === 'breast') {
      parts.push('Breastfeed');
      if (m.breastSide) parts.push(m.breastSide);
      if (m.durationMins) parts.push(`${m.durationMins}m`);
    } else if (m.mealType === 'bottle') {
      parts.push('Bottle');
      if (m.amountMl) parts.push(`${m.amountMl}ml`);
    } else {
      parts.push(m.mealType === 'solid' ? 'Solids' : 'Snack');
      if (m.food) parts.push(m.food);
    }
    lines.push(`🍼 Last feed: ${parts.join(' · ')} (${formatDistanceToNow(new Date(lastMeal.occurred_at), { addSuffix: true })}).`);
  }

  // Last nappy
  const lastNappy = recent.find((e) => e.type === 'nappy');
  if (lastNappy) {
    const m = lastNappy.metadata as Partial<NappyMetadata>;
    const type = m.nappyType ?? 'change';
    lines.push(`🧷 Last nappy: ${type.charAt(0).toUpperCase() + type.slice(1)} (${formatDistanceToNow(new Date(lastNappy.occurred_at), { addSuffix: true })}).`);
  }

  // Pumping
  const pumpSessions = recent.filter((e) => e.type === 'pump');
  if (pumpSessions.length > 0) {
    const totalMl = pumpSessions.reduce((acc, e) => {
      const m = e.metadata as Partial<PumpMetadata>;
      return acc + (m.amountMl ?? 0);
    }, 0);
    const detail = totalMl > 0 ? ` (${totalMl}ml total)` : '';
    lines.push(`🤱 ${pumpSessions.length} pumping session${pumpSessions.length > 1 ? 's' : ''}${detail}.`);
  }

  // Temperature readings
  const tempReadings = recent.filter((e) => e.type === 'temperature');
  if (tempReadings.length > 0) {
    const latest = tempReadings[0];
    const m = latest.metadata as Partial<TemperatureMetadata>;
    if (m.tempC != null) {
      const flag = m.tempC >= 38 ? ' ⚠️ Fever' : '';
      lines.push(`🌡️ Latest temp: ${m.tempC.toFixed(1)}°C${flag} (${formatDistanceToNow(new Date(latest.occurred_at), { addSuffix: true })}).`);
    }
  }

  // Medication
  const meds = recent.filter((e) => e.type === 'medication');
  if (meds.length > 0) {
    const latest = meds[0];
    const m = latest.metadata as Partial<MedicationMetadata>;
    if (m.name) {
      const detail = m.doseAmountMl ? ` ${m.doseAmountMl}ml` : '';
      let nextDoseText = '';
      if (m.doseIntervalHours) {
        const nextDose = new Date(new Date(latest.occurred_at).getTime() + m.doseIntervalHours * 3600000);
        nextDoseText = ` — next dose ${formatDistanceToNow(nextDose, { addSuffix: true })}`;
      }
      lines.push(`💊 ${m.name}${detail} given (${formatDistanceToNow(new Date(latest.occurred_at), { addSuffix: true })})${nextDoseText}.`);
    }
  }

  return { lines, generatedAt: new Date(), sinceHours };
}
