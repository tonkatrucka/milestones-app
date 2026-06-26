import {
  buildEventDays,
  formatMemoriesList,
  formatMilestonesList,
  formatPeriodSummary,
  type DailyEvent,
  type Memory,
  type Milestone,
} from './record-format.ts';

export type AgeBracket =
  | 'newborn'
  | 'infant_early'
  | 'infant'
  | 'infant_late'
  | 'toddler_early'
  | 'toddler'
  | 'toddler_late';

export type InsightCategory =
  | 'sleep'
  | 'feeding'
  | 'development'
  | 'milestones'
  | 'regression'
  | 'language';

export interface InsightDigest {
  text: string;
  hasEnoughData: boolean;
  ageBracket: AgeBracket;
  ageMonths: number;
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function ageMonthsFromDob(dob: string, currentDate: string): number {
  const birth = new Date(dob);
  const now = new Date(currentDate);
  return Math.max(
    0,
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth()),
  );
}

export function resolveAgeBracket(dob: string, currentDate: string): AgeBracket {
  const months = ageMonthsFromDob(dob, currentDate);
  if (months <= 2) return 'newborn';
  if (months <= 5) return 'infant_early';
  if (months <= 8) return 'infant';
  if (months <= 11) return 'infant_late';
  if (months <= 17) return 'toddler_early';
  if (months <= 23) return 'toddler';
  return 'toddler_late';
}

export function ageBracketLabel(bracket: AgeBracket): string {
  const labels: Record<AgeBracket, string> = {
    newborn: '0–2 months',
    infant_early: '3–5 months',
    infant: '6–8 months',
    infant_late: '9–11 months',
    toddler_early: '12–17 months',
    toddler: '18–23 months',
    toddler_late: '24–36 months',
  };
  return labels[bracket];
}

function sumWindow(events: DailyEvent[], startDate: string, endDate: string) {
  const days = buildEventDays(events).filter(
    (d) => d.dateKey >= startDate && d.dateKey <= endDate,
  );
  return {
    activeDays: days.length,
    meals: days.reduce((s, d) => s + d.counts.meal, 0),
    ml: days.reduce((s, d) => s + d.totalMl, 0),
    nappies: days.reduce((s, d) => s + d.counts.nappy, 0),
    sleepMins: days.reduce((s, d) => s + d.totalSleepMins, 0),
  };
}

function sleepHoursLabel(mins: number): string {
  if (mins === 0) return '0 hours';
  const hours = Math.round((mins / 60) * 10) / 10;
  return `${hours} hours`;
}

function weekFact(
  label: string,
  current: number,
  prior: number,
  unit: string,
): string {
  if (current === 0 && prior === 0) {
    return `- ${label}: none logged either week`;
  }
  const diff = current - prior;
  const change =
    diff === 0
      ? 'same as last week'
      : diff > 0
      ? `${diff} more than last week`
      : `${Math.abs(diff)} fewer than last week`;
  return `- ${label}: ${current} ${unit} this week (${prior} last week — ${change})`;
}

export function buildInsightDigest(
  childName: string,
  dob: string,
  currentDate: string,
  events: DailyEvent[],
  milestones: Milestone[],
  memories: Memory[],
): InsightDigest {
  const ageBracket = resolveAgeBracket(dob, currentDate);
  const ageMonths = ageMonthsFromDob(dob, currentDate);

  const last7End = currentDate;
  const last7Start = addDays(currentDate, -6);
  const prior7End = addDays(currentDate, -7);
  const prior7Start = addDays(currentDate, -13);

  const last7 = sumWindow(events, last7Start, last7End);
  const prior7 = sumWindow(events, prior7Start, prior7End);

  const last90Start = addDays(currentDate, -89);
  const events90 = events.filter((e) => {
    const key = e.occurred_at.slice(0, 10);
    return key >= last90Start && key <= currentDate;
  });
  const days90 = buildEventDays(events90);

  const hasEnoughData =
    days90.length >= 7 || milestones.length >= 2 || memories.length >= 2;

  const lines: string[] = [
    `Child: ${childName}, ${ageMonths} months old (${ageBracketLabel(ageBracket)}).`,
    `Data through ${currentDate}.`,
    '',
    'This week — raw facts (use for comparisons; do NOT copy totals alone into shortInsights):',
    `- Logged on ${last7.activeDays} of 7 days (last week: ${prior7.activeDays} of 7).`,
    weekFact('Meals', last7.meals, prior7.meals, 'total'),
    weekFact('Bottle', last7.ml, prior7.ml, 'ml total'),
    weekFact('Nappies', last7.nappies, prior7.nappies, 'total'),
    `- Sleep: ${sleepHoursLabel(last7.sleepMins)} this week (${sleepHoursLabel(prior7.sleepMins)} last week).`,
    '',
    'More detail — for longInsights only (comparisons, patterns, gentle interpretation):',
    formatPeriodSummary(events90, 90),
    '',
    milestones.length > 0
      ? formatMilestonesList(milestones.slice(0, 10))
      : 'No milestones logged recently.',
    '',
    memories.length > 0
      ? formatMemoriesList(memories.slice(0, 5))
      : 'No memories logged recently.',
    '',
    hasEnoughData
      ? 'Enough activity for a helpful summary.'
      : 'Limited activity — be honest that there is not much to go on yet.',
  ];

  return {
    text: lines.join('\n'),
    hasEnoughData,
    ageBracket,
    ageMonths,
  };
}
