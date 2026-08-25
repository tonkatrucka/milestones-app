/**
 * Doctor visit summary — content, order, and number formats.
 *
 * This is a parent-recorded briefing for a well-child / GP visit, not a
 * medical record. Sections follow the order a clinician typically scans:
 * identity → vitals snapshot → growth trend → immunisations → feeding /
 * allergens → development → sleep & nappies → recent illness.
 *
 * Windows
 *   At a glance, feeding mix, sleep, nappies  last 7 days (rolling)
 *   Temperatures and medicines                last 14 days
 *   Activity coverage line                    last 30 days of fetched logs
 *
 * Print formats
 *   Date of birth     d MMMM yyyy     e.g. 24 August 2026
 *   Other dates       d MMM yyyy      e.g. 24 Aug 2026
 *   Date + time       d MMM yyyy, h:mm a
 *   Age               N days | N months | N years M months
 *   Weight            0.00 kg         (2 decimal places)
 *   Length / HC       0.0 cm          (1 decimal place)
 *   Temperature       0.0°C           fever highlighted at ≥ 38.0°C
 *   Volume            N ml            (whole millilitres)
 *   Duration          0.0 h           hours, 1 decimal
 *   Averages          0.0 / day       over days that have logs of that type
 *   Deltas            +0.00 kg / +0.0 cm with day count between measurements
 *
 * Omitted on purpose: memories, time capsule, parent wellbeing, chat,
 * private milestones, WHO percentiles (child sex is not stored), and a
 * raw 30-day dump of every feed/nappy.
 */

import {
  differenceInDays,
  differenceInMinutes,
  differenceInMonths,
  format,
  parseISO,
} from 'date-fns';
import type {
  DailyEvent,
  FirstWord,
  FoodReaction,
  GrowthEntry,
  MealMetadata,
  MedicationMetadata,
  Milestone,
  MilestoneCategory,
  NappyMetadata,
  PumpMetadata,
  SleepMetadata,
  SolidFood,
  TemperatureMetadata,
  VaccinationRecord,
} from '@/lib/database.types';

export const VISIT_SUMMARY_FORMAT = {
  dob: 'd MMMM yyyy',
  date: 'd MMM yyyy',
  dateTime: 'd MMM yyyy, h:mm a',
  feverC: 38.0,
  growthRows: 10,
  wordRows: 12,
  avgDays: 7,
  illnessDays: 14,
  activityDays: 30,
  nightStartHour: 19,
  nightEndHour: 6,
} as const;

const MILESTONE_GROUP_ORDER: MilestoneCategory[] = [
  'language',
  'movement',
  'development',
];

const MILESTONE_GROUP_LABEL: Record<MilestoneCategory, string> = {
  language: 'Language',
  movement: 'Movement',
  development: 'Development',
};

const REACTION_RANK: Record<FoodReaction, number> = {
  severe: 0,
  moderate: 1,
  mild: 2,
  none: 3,
};

const REACTION_LABEL: Record<FoodReaction, string> = {
  none: 'None',
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
};

const TEMP_METHOD_LABEL: Record<NonNullable<TemperatureMetadata['method']>, string> = {
  axillary: 'axillary',
  rectal: 'rectal',
  ear: 'ear',
  forehead: 'forehead',
};

const NAPPY_LABEL: Record<NappyMetadata['nappyType'], string> = {
  wet: 'Wet',
  dirty: 'Dirty',
  both: 'Both',
  dry: 'Dry',
};

export interface VisitSummaryInput {
  childName: string;
  childDob: string;
  events: DailyEvent[];
  growthEntries: GrowthEntry[];
  milestones: Milestone[];
  vaccinations: VaccinationRecord[];
  solidFoods: SolidFood[];
  firstWords: FirstWord[];
  now?: Date;
}

export interface SnapshotStat {
  label: string;
  value: string;
  hint: string;
  alert?: boolean;
}

export interface TableRow {
  cells: string[];
  alert?: boolean;
  emphasis?: boolean;
}

export interface VisitSection {
  number: number;
  title: string;
  intro?: string;
  empty?: string;
  leads?: string[];
  notes?: string[];
  stats?: SnapshotStat[];
  columns?: string[];
  rows?: TableRow[];
  groups?: { heading: string; items: string[] }[];
}

export interface VisitSummaryModel {
  title: string;
  childName: string;
  metaLines: string[];
  windowNote: string;
  sections: VisitSection[];
  footer: string;
}

export function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatKg(n: number): string {
  return `${n.toFixed(2)} kg`;
}

export function formatCm(n: number): string {
  return `${n.toFixed(1)} cm`;
}

export function formatTempC(n: number): string {
  return `${n.toFixed(1)}°C`;
}

export function formatMl(n: number): string {
  return `${Math.round(n)} ml`;
}

export function formatDoseMl(n: number): string {
  return Number.isInteger(n) ? `${n} ml` : `${n.toFixed(1)} ml`;
}

export function formatHours(n: number): string {
  return `${n.toFixed(1)} h`;
}

export function formatAvg(n: number): string {
  return n.toFixed(1);
}

export function formatSigned(n: number, decimals: number, unit: string): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toFixed(decimals)} ${unit}`;
}

export function formatAgeLabel(dob: string, now: Date): string {
  const birth = parseISO(dob);
  const months = differenceInMonths(now, birth);
  const days = Math.max(0, differenceInDays(now, birth));
  if (months < 1) return days === 1 ? '1 day' : `${days} days`;
  if (months < 12) return months === 1 ? '1 month' : `${months} months`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const yearPart = years === 1 ? '1 year' : `${years} years`;
  if (rem === 0) return yearPart;
  const monthPart = rem === 1 ? '1 month' : `${rem} months`;
  return `${yearPart} ${monthPart}`;
}

function dash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

function parseWhen(iso: string): Date {
  return parseISO(iso);
}

function formatDate(iso: string): string {
  return format(parseWhen(iso), VISIT_SUMMARY_FORMAT.date);
}

function formatDateTime(iso: string): string {
  return format(parseWhen(iso), VISIT_SUMMARY_FORMAT.dateTime);
}

function inLastDays(iso: string, now: Date, days: number): boolean {
  const t = parseWhen(iso).getTime();
  const start = now.getTime() - days * 24 * 60 * 60 * 1000;
  return t >= start && t <= now.getTime();
}

function eventsInWindow(events: DailyEvent[], now: Date, days: number): DailyEvent[] {
  return events.filter((ev) => inLastDays(ev.occurred_at, now, days));
}

function dateKey(iso: string): string {
  return format(parseWhen(iso), 'yyyy-MM-dd');
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function dailySums(
  events: DailyEvent[],
  valueOf: (event: DailyEvent) => number,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const event of events) {
    const add = valueOf(event);
    if (add === 0) continue;
    const key = dateKey(event.occurred_at);
    totals.set(key, (totals.get(key) ?? 0) + add);
  }
  return totals;
}

function addHoursByCalendarDay(start: Date, end: Date, into: Map<string, number>): void {
  let cursor = start.getTime();
  const finish = end.getTime();
  if (finish <= cursor) return;
  while (cursor < finish) {
    const current = new Date(cursor);
    const nextMidnight = new Date(current);
    nextMidnight.setHours(24, 0, 0, 0);
    const sliceEnd = Math.min(nextMidnight.getTime(), finish);
    const hours = (sliceEnd - cursor) / (60 * 60 * 1000);
    const key = format(current, 'yyyy-MM-dd');
    into.set(key, (into.get(key) ?? 0) + hours);
    cursor = sliceEnd;
  }
}

function sleepHoursByDay(
  events: DailyEvent[],
  predicate: (event: DailyEvent) => boolean = () => true,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const event of events) {
    if (!predicate(event)) continue;
    const mins = sleepMinutes(event);
    if (mins == null) continue;
    const endIso = (event.metadata as SleepMetadata).sleepEnd;
    if (!endIso) continue;
    addHoursByCalendarDay(parseWhen(event.occurred_at), parseWhen(endIso), totals);
  }
  return totals;
}

function avgPerLoggedDay(totals: Map<string, number>): { avg: number | null; days: number } {
  const values = [...totals.values()];
  return { avg: mean(values), days: values.length };
}

function asMeal(event: DailyEvent): Partial<MealMetadata> {
  return event.metadata as Partial<MealMetadata>;
}

function sleepMinutes(event: DailyEvent): number | null {
  if (event.type !== 'sleep') return null;
  const end = (event.metadata as SleepMetadata).sleepEnd;
  if (!end) return null;
  return Math.max(0, differenceInMinutes(parseWhen(end), parseWhen(event.occurred_at)));
}

function isNightSleep(event: DailyEvent): boolean {
  const hour = parseWhen(event.occurred_at).getHours();
  return hour >= VISIT_SUMMARY_FORMAT.nightStartHour || hour < VISIT_SUMMARY_FORMAT.nightEndHour;
}

function sortGrowth(entries: GrowthEntry[]): GrowthEntry[] {
  return [...entries].sort(
    (a, b) => parseWhen(b.measured_at).getTime() - parseWhen(a.measured_at).getTime(),
  );
}

function coverageLabel(events: DailyEvent[]): string {
  if (events.length === 0) {
    return `No activity logged in the last ${VISIT_SUMMARY_FORMAT.activityDays} days`;
  }
  const times = events.map((ev) => parseWhen(ev.occurred_at).getTime());
  const start = format(new Date(Math.min(...times)), VISIT_SUMMARY_FORMAT.date);
  const end = format(new Date(Math.max(...times)), VISIT_SUMMARY_FORMAT.date);
  return `Activity window: last ${VISIT_SUMMARY_FORMAT.activityDays} days (${start} – ${end})`;
}

function daysWithLogsHint(days: number, empty: string): string {
  if (days === 0) return empty;
  return days === 1 ? '1 day with logs' : `${days} days with logs`;
}

function buildSnapshot(
  latest: GrowthEntry | undefined,
  week: DailyEvent[],
  fortnight: DailyEvent[],
): SnapshotStat[] {
  const measured = latest ? formatDate(latest.measured_at) : 'No measurement recorded';

  const mealTotals = dailySums(
    week.filter((ev) => ev.type === 'meal'),
    () => 1,
  );
  const meals = avgPerLoggedDay(mealTotals);

  const bottleTotals = dailySums(
    week.filter((ev) => ev.type === 'meal' && asMeal(ev).mealType === 'bottle'),
    (ev) => asMeal(ev).amountMl ?? 0,
  );
  const bottles = avgPerLoggedDay(bottleTotals);

  const sleepEvents = week.filter((ev) => ev.type === 'sleep');
  const completedSleep = sleepEvents.filter((ev) => sleepMinutes(ev) != null);
  const sleepHourTotals = sleepHoursByDay(completedSleep);
  const sleep = avgPerLoggedDay(sleepHourTotals);
  const napTotals = dailySums(
    completedSleep.filter((ev) => !isNightSleep(ev)),
    () => 1,
  );
  const naps = avgPerLoggedDay(napTotals);

  const nappyEvents = week.filter((ev) => ev.type === 'nappy');
  const nappyTotals = dailySums(nappyEvents, () => 1);
  const nappies = avgPerLoggedDay(nappyTotals);
  const wetCount = nappyEvents.filter((ev) => {
    const type = (ev.metadata as NappyMetadata).nappyType;
    return type === 'wet' || type === 'both';
  }).length;
  const dirtyCount = nappyEvents.filter((ev) => {
    const type = (ev.metadata as NappyMetadata).nappyType;
    return type === 'dirty' || type === 'both';
  }).length;

  const temps = fortnight
    .filter((ev) => ev.type === 'temperature')
    .map((ev) => ({
      event: ev,
      tempC: (ev.metadata as TemperatureMetadata).tempC,
    }))
    .filter((row) => Number.isFinite(row.tempC));
  const peak = temps.reduce<(typeof temps)[number] | null>((best, row) => {
    if (!best || row.tempC > best.tempC) return row;
    return best;
  }, null);

  const meds = fortnight.filter((ev) => ev.type === 'medication');
  const medCounts = new Map<string, number>();
  for (const ev of meds) {
    const name = (ev.metadata as MedicationMetadata).name?.trim() || 'Medication';
    medCounts.set(name, (medCounts.get(name) ?? 0) + 1);
  }
  const medValue =
    medCounts.size === 0
      ? 'None'
      : [...medCounts.entries()]
          .map(([name, count]) => `${name} (${count} ${count === 1 ? 'dose' : 'doses'})`)
          .join('; ');

  return [
    {
      label: 'Weight',
      value: latest?.weight_kg != null ? formatKg(latest.weight_kg) : '—',
      hint: latest ? measured : 'None recorded',
    },
    {
      label: 'Length / height',
      value: latest?.height_cm != null ? formatCm(latest.height_cm) : '—',
      hint: latest ? measured : 'None recorded',
    },
    {
      label: 'Head circumference',
      value: latest?.head_cm != null ? formatCm(latest.head_cm) : '—',
      hint: latest ? measured : 'None recorded',
    },
    {
      label: 'Feeds / day',
      value: meals.avg == null ? '—' : `${formatAvg(meals.avg)} / day`,
      hint: daysWithLogsHint(meals.days, 'No feeds in the last 7 days'),
    },
    {
      label: 'Bottle volume / day',
      value: bottles.avg == null ? '—' : `${formatMl(bottles.avg)} / day`,
      hint: daysWithLogsHint(bottles.days, 'No bottles in the last 7 days'),
    },
    {
      label: 'Sleep / day',
      value: sleep.avg == null ? '—' : `${formatHours(sleep.avg)} / day`,
      hint:
        sleep.avg == null
          ? 'No completed sleeps in the last 7 days'
          : `${naps.avg == null ? '0.0' : formatAvg(naps.avg)} naps / day · ${daysWithLogsHint(sleep.days, '')}`,
    },
    {
      label: 'Nappies / day',
      value: nappies.avg == null ? '—' : `${formatAvg(nappies.avg)} / day`,
      hint:
        nappies.avg == null
          ? 'No nappies in the last 7 days'
          : `wet ${formatAvg(wetCount / nappies.days)} · dirty ${formatAvg(dirtyCount / nappies.days)} / day · ${daysWithLogsHint(nappies.days, '')}`,
    },
    {
      label: 'Highest temperature (14 d)',
      value: peak ? formatTempC(peak.tempC) : '—',
      hint: peak
        ? [
            formatDateTime(peak.event.occurred_at),
            (peak.event.metadata as TemperatureMetadata).method
              ? TEMP_METHOD_LABEL[(peak.event.metadata as TemperatureMetadata).method!]
              : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : 'None logged in the last 14 days',
      alert: peak != null && peak.tempC >= VISIT_SUMMARY_FORMAT.feverC,
    },
    {
      label: 'Medicines (14 d)',
      value: medValue,
      hint:
        meds.length === 0
          ? 'None logged in the last 14 days'
          : `${meds.length} ${meds.length === 1 ? 'dose' : 'doses'} in 14 days`,
    },
  ];
}

function growthChangeLine(latest: GrowthEntry, previous: GrowthEntry): string {
  const days = Math.max(0, differenceInDays(parseWhen(latest.measured_at), parseWhen(previous.measured_at)));
  const parts: string[] = [];
  if (latest.weight_kg != null && previous.weight_kg != null) {
    parts.push(formatSigned(latest.weight_kg - previous.weight_kg, 2, 'kg'));
  }
  if (latest.height_cm != null && previous.height_cm != null) {
    parts.push(formatSigned(latest.height_cm - previous.height_cm, 1, 'cm'));
  }
  if (latest.head_cm != null && previous.head_cm != null) {
    parts.push(`HC ${formatSigned(latest.head_cm - previous.head_cm, 1, 'cm')}`);
  }
  const dayLabel = days === 1 ? '1 day' : `${days} days`;
  if (parts.length === 0) {
    return `Previous measurement on ${formatDate(previous.measured_at)} (${dayLabel}) has no overlapping fields to compare.`;
  }
  return `Change since ${formatDate(previous.measured_at)} (${dayLabel}): ${parts.join(' · ')}`;
}

function growthLatestLine(entry: GrowthEntry): string {
  const parts: string[] = [];
  if (entry.weight_kg != null) parts.push(formatKg(entry.weight_kg));
  if (entry.height_cm != null) parts.push(formatCm(entry.height_cm));
  if (entry.head_cm != null) parts.push(`HC ${formatCm(entry.head_cm)}`);
  const measures = parts.length > 0 ? parts.join(' · ') : 'no numeric values';
  return `Latest (${formatDate(entry.measured_at)}): ${measures}.`;
}

function buildGrowthSection(entries: GrowthEntry[]): VisitSection {
  const sorted = sortGrowth(entries);
  if (sorted.length === 0) {
    return {
      number: 2,
      title: 'Growth',
      empty: 'None recorded in Milestones.',
    };
  }

  const latest = sorted[0];
  const previous = sorted[1];
  const tableSource = sorted.slice(0, VISIT_SUMMARY_FORMAT.growthRows).slice().reverse();
  const leads = [growthLatestLine(latest)];
  if (previous) leads.push(growthChangeLine(latest, previous));
  else leads.push('No previous measurement to compare.');

  const notes: string[] = [];
  if (sorted.length > VISIT_SUMMARY_FORMAT.growthRows) {
    notes.push(
      `Showing the ${VISIT_SUMMARY_FORMAT.growthRows} most recent of ${sorted.length} measurements, oldest to newest. Latest row is in bold.`,
    );
  } else {
    notes.push('Measurements are listed oldest to newest. Latest row is in bold.');
  }
  notes.push('Weight to 2 decimal places (kg); length and head circumference to 1 decimal place (cm). Percentiles are omitted because sex is not stored.');

  return {
    number: 2,
    title: 'Growth',
    leads,
    notes,
    columns: ['Date', 'Weight', 'Length / height', 'Head circ.', 'Notes'],
    rows: tableSource.map((entry) => ({
      emphasis: entry.id === latest.id,
      cells: [
        formatDate(entry.measured_at),
        entry.weight_kg != null ? formatKg(entry.weight_kg) : '—',
        entry.height_cm != null ? formatCm(entry.height_cm) : '—',
        entry.head_cm != null ? formatCm(entry.head_cm) : '—',
        dash(entry.notes),
      ],
    })),
  };
}

function buildImmunisationsSection(vaccinations: VaccinationRecord[]): VisitSection {
  const sorted = [...vaccinations].sort(
    (a, b) => parseWhen(b.administered_at).getTime() - parseWhen(a.administered_at).getTime(),
  );
  if (sorted.length === 0) {
    return {
      number: 3,
      title: 'Immunisations',
      empty: 'None recorded in Milestones.',
    };
  }
  return {
    number: 3,
    title: 'Immunisations',
    notes: ['Most recent first.'],
    columns: ['Date', 'Vaccine', 'Dose', 'Clinic', 'Batch', 'Reactions'],
    rows: sorted.map((v) => ({
      cells: [
        formatDate(v.administered_at),
        v.vaccine_name,
        `Dose ${v.dose_number}`,
        dash(v.clinic),
        dash(v.batch_number),
        dash(v.reaction_notes),
      ],
    })),
  };
}

function foodReaction(food: SolidFood): FoodReaction {
  return food.reaction ?? 'none';
}

export function sortSolidFoodsForVisit(foods: SolidFood[]): SolidFood[] {
  return [...foods].sort((a, b) => {
    const rank = REACTION_RANK[foodReaction(a)] - REACTION_RANK[foodReaction(b)];
    if (rank !== 0) return rank;
    if (a.is_top_allergen !== b.is_top_allergen) return a.is_top_allergen ? -1 : 1;
    return parseWhen(b.introduced_at).getTime() - parseWhen(a.introduced_at).getTime();
  });
}

function buildFeedingSection(foods: SolidFood[], week: DailyEvent[]): VisitSection {
  const sortedFoods = sortSolidFoodsForVisit(foods);
  const reactionCallouts = sortedFoods
    .filter((f) => foodReaction(f) !== 'none')
    .map((f) => {
      const extra = f.reaction_notes?.trim() ? ` — ${f.reaction_notes.trim()}` : '';
      return `${f.food_name} · ${REACTION_LABEL[foodReaction(f)]} (${formatDate(f.introduced_at)})${extra}`;
    });

  const meals = week.filter((ev) => ev.type === 'meal');
  const pumps = week.filter((ev) => ev.type === 'pump');
  const breast = meals.filter((ev) => asMeal(ev).mealType === 'breast');
  const bottle = meals.filter((ev) => asMeal(ev).mealType === 'bottle');
  const solids = meals.filter((ev) => asMeal(ev).mealType === 'solid' || asMeal(ev).mealType === 'snack');
  const bottleMl = bottle.reduce((sum, ev) => sum + (asMeal(ev).amountMl ?? 0), 0);
  const pumpMl = pumps.reduce((sum, ev) => sum + ((ev.metadata as PumpMetadata).amountMl ?? 0), 0);
  const breastDurations = breast
    .map((ev) => asMeal(ev).durationMins)
    .filter((n): n is number => n != null);
  const breastDays = new Set(breast.map((ev) => dateKey(ev.occurred_at))).size;
  const bottleDays = new Set(bottle.map((ev) => dateKey(ev.occurred_at))).size;

  const mix: string[] = [];
  if (breast.length > 0) {
    const avg = breastDays > 0 ? formatAvg(breast.length / breastDays) : formatAvg(breast.length);
    const duration =
      breastDurations.length > 0
        ? ` · avg ${Math.round(mean(breastDurations) ?? 0)} min / feed`
        : '';
    mix.push(
      `Breast: ${breast.length} ${breast.length === 1 ? 'feed' : 'feeds'} (${avg} / day over ${breastDays} ${breastDays === 1 ? 'day' : 'days'})${duration}`,
    );
  } else {
    mix.push('Breast: none logged in the last 7 days.');
  }
  if (bottle.length > 0) {
    const avgMl = bottleDays > 0 ? bottleMl / bottleDays : bottleMl;
    mix.push(
      `Bottle: ${bottle.length} ${bottle.length === 1 ? 'feed' : 'feeds'}, ${formatMl(bottleMl)} total (${formatMl(avgMl)} / day over ${bottleDays} ${bottleDays === 1 ? 'day' : 'days'}).`,
    );
  } else {
    mix.push('Bottle: none logged in the last 7 days.');
  }
  mix.push(
    solids.length > 0
      ? `Solids / snacks: ${solids.length} ${solids.length === 1 ? 'meal' : 'meals'} in the last 7 days.`
      : 'Solids / snacks: none logged in the last 7 days.',
  );
  mix.push(
    pumps.length > 0
      ? `Expressed milk: ${pumps.length} ${pumps.length === 1 ? 'session' : 'sessions'}, ${formatMl(pumpMl)} total.`
      : 'Expressed milk: none logged in the last 7 days.',
  );

  const leads = [
    '7-day feeding mix (days with logs of that type):',
    ...mix,
  ];
  if (reactionCallouts.length > 0) {
    leads.unshift(`Recorded food reactions: ${reactionCallouts.join('; ')}.`);
  }

  if (sortedFoods.length === 0) {
    return {
      number: 4,
      title: 'Feeding and allergens',
      leads,
      empty: 'No solid foods recorded in Milestones.',
    };
  }

  return {
    number: 4,
    title: 'Feeding and allergens',
    leads,
    notes: [
      'Solids are ordered by reaction severity, then top allergens, then newest introduction date.',
    ],
    columns: ['Introduced', 'Food', 'Allergen', 'Reaction', 'Notes'],
    rows: sortedFoods.map((food) => {
      const reaction = foodReaction(food);
      return {
        alert: reaction === 'moderate' || reaction === 'severe',
        emphasis: reaction === 'mild',
        cells: [
          formatDate(food.introduced_at),
          food.food_name,
          food.is_top_allergen ? 'Top allergen' : '—',
          REACTION_LABEL[reaction],
          dash([food.reaction_notes, food.notes].filter(Boolean).join(' — ')),
        ],
      };
    }),
  };
}

function buildDevelopmentSection(
  milestones: Milestone[],
  words: FirstWord[],
): VisitSection {
  const publicMilestones = milestones.filter((m) => !m.is_private);
  const groups = MILESTONE_GROUP_ORDER.map((category) => {
    const items = publicMilestones
      .filter((m) => m.category === category)
      .sort((a, b) => parseWhen(b.achieved_at).getTime() - parseWhen(a.achieved_at).getTime())
      .map((m) => {
        const desc = m.description?.trim();
        return desc
          ? `${formatDate(m.achieved_at)} — ${m.title}. ${desc}`
          : `${formatDate(m.achieved_at)} — ${m.title}`;
      });
    return {
      heading: `${MILESTONE_GROUP_LABEL[category]} (${items.length})`,
      items,
    };
  }).filter((group) => group.items.length > 0);

  const sortedWords = [...words].sort(
    (a, b) => parseWhen(b.said_at).getTime() - parseWhen(a.said_at).getTime(),
  );
  const wordRows = sortedWords.slice(0, VISIT_SUMMARY_FORMAT.wordRows);
  const notes: string[] = [];
  if (milestones.length !== publicMilestones.length) {
    notes.push('Private milestones are excluded from this summary.');
  }
  if (sortedWords.length > VISIT_SUMMARY_FORMAT.wordRows) {
    notes.push(
      `Showing the ${VISIT_SUMMARY_FORMAT.wordRows} most recent of ${sortedWords.length} first words.`,
    );
  }

  if (groups.length === 0 && wordRows.length === 0) {
    return {
      number: 5,
      title: 'Development',
      empty: 'No public milestones or first words recorded in Milestones.',
      notes: notes.length > 0 ? notes : undefined,
    };
  }

  const columns = wordRows.length > 0 ? ['Said', 'Word', 'How it sounds'] : undefined;
  const rows =
    wordRows.length > 0
      ? wordRows.map((word) => ({
          cells: [formatDate(word.said_at), word.word, dash(word.phonetic)],
        }))
      : undefined;

  const leads =
    sortedWords.length > 0
      ? [`First words: ${sortedWords.length} recorded.`]
      : undefined;

  return {
    number: 5,
    title: 'Development',
    leads,
    notes: notes.length > 0 ? notes : undefined,
    groups,
    columns,
    rows,
  };
}

function buildSleepNappySection(week: DailyEvent[]): VisitSection {
  const sleepEvents = week.filter((ev) => ev.type === 'sleep');
  const completed = sleepEvents.filter((ev) => sleepMinutes(ev) != null);
  const ongoing = sleepEvents.length - completed.length;
  const night = completed.filter(isNightSleep);
  const naps = completed.filter((ev) => !isNightSleep(ev));

  const sleepHoursByCalendarDay = sleepHoursByDay(completed);
  const nightHoursByDay = sleepHoursByDay(night);
  const napHoursByDay = sleepHoursByDay(naps);
  const napCountByDay = dailySums(naps, () => 1);
  const sleepAvg = avgPerLoggedDay(sleepHoursByCalendarDay);
  const dailyHourValues = [...sleepHoursByCalendarDay.values()];
  const totalHours = dailyHourValues.reduce((sum, n) => sum + n, 0);
  const range =
    dailyHourValues.length > 0
      ? `${formatHours(Math.min(...dailyHourValues))}–${formatHours(Math.max(...dailyHourValues))}`
      : null;

  const nappyEvents = week.filter((ev) => ev.type === 'nappy');
  const nappyByDay = dailySums(nappyEvents, () => 1);
  const nappyAvg = avgPerLoggedDay(nappyByDay);
  const mix: Record<NappyMetadata['nappyType'], number> = {
    wet: 0,
    dirty: 0,
    both: 0,
    dry: 0,
  };
  for (const ev of nappyEvents) {
    const type = (ev.metadata as NappyMetadata).nappyType;
    if (type && type in mix) mix[type] += 1;
  }

  const leads: string[] = [];
  if (sleepAvg.avg == null) {
    leads.push('Sleep: no completed sleep sessions in the last 7 days.');
  } else {
    leads.push(
      `Total sleep: ${formatHours(totalHours)} in 7 days · ${formatHours(sleepAvg.avg)} / day (range ${range}) over ${sleepAvg.days} ${sleepAvg.days === 1 ? 'day' : 'days'} with sleep.`,
    );
    const nightAvg = avgPerLoggedDay(nightHoursByDay);
    leads.push(
      nightAvg.avg == null
        ? 'Night sleep: none with a start time between 7:00 pm and 5:59 am.'
        : `Night sleep: ${formatHours(nightAvg.avg)} / day (sessions starting 7:00 pm–5:59 am).`,
    );
    const napHourAvg = avgPerLoggedDay(napHoursByDay);
    const napCountAvg = avgPerLoggedDay(napCountByDay);
    leads.push(
      napCountAvg.avg == null
        ? 'Naps: none logged in the last 7 days.'
        : `Naps: ${formatAvg(napCountAvg.avg)} / day, ${formatHours(napHourAvg.avg ?? 0)} / day.`,
    );
  }
  if (ongoing > 0) {
    leads.push(
      `${ongoing} ${ongoing === 1 ? 'session' : 'sessions'} had no end time and ${ongoing === 1 ? 'was' : 'were'} excluded from sleep totals.`,
    );
  }

  if (nappyAvg.avg == null) {
    leads.push('Nappies: none logged in the last 7 days.');
  } else {
    const mixParts = (Object.keys(mix) as NappyMetadata['nappyType'][])
      .filter((key) => mix[key] > 0)
      .map((key) => `${NAPPY_LABEL[key].toLowerCase()} ${mix[key]}`);
    leads.push(
      `Nappies: ${formatAvg(nappyAvg.avg)} / day over ${nappyAvg.days} ${nappyAvg.days === 1 ? 'day' : 'days'} (${mixParts.join(' · ') || 'type not recorded'}).`,
    );
  }

  const hasData = completed.length > 0 || nappyEvents.length > 0;
  return {
    number: 6,
    title: 'Sleep and nappies',
    intro:
      '7-day averages use only days that have logs of that type. Night vs nap is estimated from start time (night = 7:00 pm–5:59 am).',
    empty: hasData ? undefined : 'No sleep or nappies logged in the last 7 days.',
    leads: hasData ? leads : undefined,
  };
}

function tempMethodLabel(event: DailyEvent): string {
  const method = (event.metadata as TemperatureMetadata).method;
  return method ? TEMP_METHOD_LABEL[method] : '—';
}

function buildConcernsSection(fortnight: DailyEvent[]): VisitSection {
  const temps = fortnight
    .filter((ev) => ev.type === 'temperature')
    .sort((a, b) => parseWhen(b.occurred_at).getTime() - parseWhen(a.occurred_at).getTime());
  const meds = fortnight
    .filter((ev) => ev.type === 'medication')
    .sort((a, b) => parseWhen(b.occurred_at).getTime() - parseWhen(a.occurred_at).getTime());

  const leads: string[] = [];
  if (temps.length === 0) leads.push('Temperatures: none logged in the last 14 days.');
  if (meds.length === 0) leads.push('Medicines: none logged in the last 14 days.');

  const rows: TableRow[] = [
    ...temps.map((ev) => {
      const tempC = (ev.metadata as TemperatureMetadata).tempC;
      return {
        alert: tempC >= VISIT_SUMMARY_FORMAT.feverC,
        cells: [
          formatDateTime(ev.occurred_at),
          'Temperature',
          Number.isFinite(tempC) ? formatTempC(tempC) : '—',
          tempMethodLabel(ev),
          dash(ev.notes),
        ],
      };
    }),
    ...meds.map((ev) => {
      const meta = ev.metadata as MedicationMetadata;
      const dose = meta.doseAmountMl != null ? formatDoseMl(meta.doseAmountMl) : '—';
      return {
        cells: [
          formatDateTime(ev.occurred_at),
          meta.name?.trim() || 'Medication',
          dose,
          meta.doseIntervalHours != null ? `every ${meta.doseIntervalHours} h` : '—',
          dash([meta.notes, ev.notes].filter(Boolean).join(' — ')),
        ],
      };
    }),
  ];

  if (rows.length === 0) {
    return {
      number: 7,
      title: 'Recent illness and medicines',
      empty: 'None logged in the last 14 days.',
    };
  }

  return {
    number: 7,
    title: 'Recent illness and medicines',
    intro: 'Last 14 days, newest first. Temperatures at or above 38.0°C are highlighted.',
    leads: leads.length > 0 ? leads : undefined,
    columns: ['When', 'Type / name', 'Value / dose', 'Method / interval', 'Notes'],
    rows,
  };
}

export function buildVisitSummary(input: VisitSummaryInput): VisitSummaryModel {
  const now = input.now ?? new Date();
  const week = eventsInWindow(input.events, now, VISIT_SUMMARY_FORMAT.avgDays);
  const fortnight = eventsInWindow(input.events, now, VISIT_SUMMARY_FORMAT.illnessDays);
  const growth = sortGrowth(input.growthEntries);

  return {
    title: `${input.childName} — Doctor visit summary`,
    childName: input.childName,
    metaLines: [
      `Date of birth: ${format(parseISO(input.childDob), VISIT_SUMMARY_FORMAT.dob)}  ·  Age: ${formatAgeLabel(input.childDob, now)}`,
      `Prepared: ${format(now, VISIT_SUMMARY_FORMAT.dateTime)}  ·  ${coverageLabel(input.events)}`,
    ],
    windowNote:
      'At a glance, feeding, sleep, and nappies use the last 7 days unless a line says otherwise. Temperatures and medicines cover 14 days. This is parent-recorded, not a medical record.',
    sections: [
      {
        number: 1,
        title: 'At a glance',
        intro:
          'Latest measurements plus 7-day averages (over days with logs). Highest temperature and medicines look back 14 days.',
        stats: buildSnapshot(growth[0], week, fortnight),
      },
      buildGrowthSection(input.growthEntries),
      buildImmunisationsSection(input.vaccinations),
      buildFeedingSection(input.solidFoods, week),
      buildDevelopmentSection(input.milestones, input.firstWords),
      buildSleepNappySection(week),
      buildConcernsSection(fortnight),
    ],
    footer:
      'Generated by Milestones from parent-recorded entries. This is not a medical record and may be incomplete. Always follow your healthcare provider’s advice.',
  };
}

function renderStats(stats: SnapshotStat[]): string {
  return `<div class="stats">${stats
    .map(
      (stat) => `
    <div class="stat${stat.alert ? ' alert' : ''}">
      <div class="k">${escHtml(stat.label)}</div>
      <div class="v">${escHtml(stat.value)}</div>
      <div class="h">${escHtml(stat.hint)}</div>
    </div>`,
    )
    .join('')}
  </div>`;
}

function renderTable(columns: string[], rows: TableRow[]): string {
  const head = columns.map((c) => `<th>${escHtml(c)}</th>`).join('');
  const body = rows
    .map((row) => {
      const cls = [row.alert ? 'alert' : '', row.emphasis ? 'latest' : ''].filter(Boolean).join(' ');
      const cells = row.cells.map((cell) => `<td>${escHtml(cell)}</td>`).join('');
      return `<tr${cls ? ` class="${cls}"` : ''}>${cells}</tr>`;
    })
    .join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderSection(section: VisitSection): string {
  const parts: string[] = [
    `<h2><span class="num">${section.number}.</span> ${escHtml(section.title)}</h2>`,
  ];
  if (section.intro) parts.push(`<p class="intro">${escHtml(section.intro)}</p>`);
  if (section.leads) {
    parts.push(
      section.leads.map((line) => `<p class="lead">${escHtml(line)}</p>`).join(''),
    );
  }
  if (section.stats) parts.push(renderStats(section.stats));
  if (section.groups) {
    for (const group of section.groups) {
      parts.push(`<h3>${escHtml(group.heading)}</h3>`);
      parts.push(
        `<ul>${group.items.map((item) => `<li>${escHtml(item)}</li>`).join('')}</ul>`,
      );
    }
  }
  if (section.columns && section.rows) parts.push(renderTable(section.columns, section.rows));
  if (section.empty) parts.push(`<p class="empty">${escHtml(section.empty)}</p>`);
  if (section.notes) {
    parts.push(section.notes.map((note) => `<p class="note">${escHtml(note)}</p>`).join(''));
  }
  return parts.join('\n');
}

export function buildVisitSummaryHtml(input: VisitSummaryInput): string {
  const model = buildVisitSummary(input);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${escHtml(model.title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 11px; color: #222; padding: 28px; line-height: 1.4; }
    h1 { font-size: 20px; font-weight: 800; margin-bottom: 6px; }
    h2 { font-size: 13px; font-weight: 700; margin: 22px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    h2 .num { color: #888; }
    h3 { font-size: 11px; font-weight: 700; margin: 10px 0 4px; }
    .meta { font-size: 11px; color: #444; margin-bottom: 4px; font-style: normal; }
    .window { font-size: 10px; color: #666; margin: 8px 0 4px; font-style: italic; }
    .intro, .note { font-size: 10px; color: #666; font-style: italic; margin-bottom: 6px; }
    .lead { color: #222; font-style: normal; margin-bottom: 4px; }
    .empty { color: #666; font-style: italic; margin: 4px 0 6px; }
    .stats { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 4px; }
    .stat { width: 31%; border: 1px solid #ddd; border-radius: 6px; padding: 8px; }
    .stat.alert { background: #fff4f0; border-color: #e07070; }
    .stat .k { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #666; margin-bottom: 2px; }
    .stat .v { font-size: 14px; font-weight: 700; }
    .stat .h { font-size: 9px; color: #666; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0 8px; }
    th { text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #555; border-bottom: 1px solid #ccc; padding: 4px 6px; }
    td { padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
    tr.latest td { font-weight: 700; }
    tr.alert td { background: #fff4f0; }
    ul { margin: 0 0 8px 16px; }
    li { margin-bottom: 3px; }
    .footer { margin-top: 28px; font-size: 9px; color: #888; text-align: center; font-style: normal; }
  </style>
</head>
<body>
  <h1>${escHtml(model.title)}</h1>
  ${model.metaLines.map((line) => `<p class="meta">${escHtml(line)}</p>`).join('\n')}
  <p class="window">${escHtml(model.windowNote)}</p>
  ${model.sections.map(renderSection).join('\n')}
  <p class="footer">${escHtml(model.footer)}</p>
</body>
</html>`;
}

export const VISIT_SUMMARY_SECTION_TITLES = [
  'At a glance',
  'Growth',
  'Immunisations',
  'Feeding and allergens',
  'Development',
  'Sleep and nappies',
  'Recent illness and medicines',
] as const;
