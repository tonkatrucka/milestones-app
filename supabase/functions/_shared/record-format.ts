// Shared record formatting for edge functions — mirrors lib/event-display.ts and
// lib/timeline-sections.ts so assistant answers match the UI.

export type EventType = 'nappy' | 'meal' | 'sleep';

export interface DailyEvent {
  id: string;
  child_id: string;
  type: EventType;
  occurred_at: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface Milestone {
  id: string;
  child_id: string;
  category: string;
  title: string;
  description: string | null;
  achieved_at: string;
  media_urls: string[];
  created_by: string | null;
  created_at: string;
}

export interface Memory {
  id: string;
  child_id: string;
  title: string;
  description: string | null;
  occurred_at: string;
  media_urls: string[];
  tags: string[];
  created_by: string | null;
  created_at: string;
}

export interface EventDay {
  dateKey: string;
  events: DailyEvent[];
  counts: Record<EventType, number>;
  totalMl: number;
  totalSleepMins: number;
  nappyByType: Record<string, number>;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  const minStr = minutes < 10 ? `0${minutes}` : String(minutes);
  return `${hours}:${minStr}${ampm}`;
}

function formatSleepDuration(mins: number): string {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins}m`;
}

export function getEventDetail(event: DailyEvent): string {
  const meta = event.metadata;
  switch (event.type) {
    case 'nappy': {
      const t = meta.nappyType as string | undefined;
      return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
    }
    case 'meal': {
      const parts: string[] = [];
      const mealType = meta.mealType as string | undefined;
      if (mealType) parts.push(mealType.charAt(0).toUpperCase() + mealType.slice(1));
      if (mealType === 'breast') {
        const side = meta.breastSide as string | undefined;
        if (side) parts.push(side.charAt(0).toUpperCase() + side.slice(1));
        if (typeof meta.durationMins === 'number') parts.push(`${meta.durationMins}m`);
        else if (typeof meta.amountMl === 'number') parts.push(`${meta.amountMl}ml`);
      } else {
        if (typeof meta.amountMl === 'number') parts.push(`${meta.amountMl}ml`);
        if (meta.food) parts.push(String(meta.food));
      }
      return parts.join(' · ');
    }
    case 'sleep': {
      const sleepEnd = meta.sleepEnd as string | undefined;
      if (sleepEnd) {
        const mins = Math.max(
          0,
          Math.round((new Date(sleepEnd).getTime() - new Date(event.occurred_at).getTime()) / 60000),
        );
        return formatSleepDuration(mins);
      }
      return 'Ongoing';
    }
    default:
      return '';
  }
}

export function formatEventTime(event: DailyEvent): string {
  return formatTime(event.occurred_at);
}

export function formatEventSummary(event: DailyEvent): string {
  const labels: Record<EventType, string> = { nappy: 'Nappy', meal: 'Meal', sleep: 'Sleep' };
  const detail = getEventDetail(event);
  return detail ? `${labels[event.type]} · ${detail}` : labels[event.type];
}

function emptyDay(dateKey: string): EventDay {
  return {
    dateKey,
    events: [],
    counts: { nappy: 0, meal: 0, sleep: 0 },
    totalMl: 0,
    totalSleepMins: 0,
    nappyByType: {},
  };
}

export function buildEventDays(events: DailyEvent[]): EventDay[] {
  const dayMap = new Map<string, EventDay>();

  const ensureDay = (dateKey: string): EventDay => {
    if (!dayMap.has(dateKey)) dayMap.set(dateKey, emptyDay(dateKey));
    return dayMap.get(dateKey)!;
  };

  const dateKeyFromIso = (iso: string): string => {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  for (const e of events) {
    const dateKey = dateKeyFromIso(e.occurred_at);
    const day = ensureDay(dateKey);
    day.events.push(e);
    day.counts[e.type] = (day.counts[e.type] ?? 0) + 1;

    if (e.type === 'meal' && typeof e.metadata.amountMl === 'number') {
      day.totalMl += e.metadata.amountMl;
    }

    if (e.type === 'sleep' && typeof e.metadata.sleepEnd === 'string') {
      const mins = Math.round(
        (new Date(e.metadata.sleepEnd).getTime() - new Date(e.occurred_at).getTime()) / 60000,
      );
      if (mins > 0) day.totalSleepMins += mins;
    }

    if (e.type === 'nappy' && typeof e.metadata.nappyType === 'string') {
      const t = e.metadata.nappyType;
      day.nappyByType[t] = (day.nappyByType[t] ?? 0) + 1;
    }
  }

  const days = Array.from(dayMap.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  for (const d of days) {
    d.events.sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    );
  }
  return days;
}

export function formatDaySummary(day: EventDay, childName?: string): string {
  const parts: string[] = [];
  const name = childName ?? 'Baby';

  if (day.counts.meal > 0) {
    parts.push(`${day.counts.meal} meal${day.counts.meal !== 1 ? 's' : ''}${day.totalMl > 0 ? ` (${day.totalMl}ml bottle total)` : ''}`);
  }
  if (day.counts.nappy > 0) {
    const nappyParts = Object.entries(day.nappyByType)
      .map(([t, n]) => `${n} ${t}`)
      .join(', ');
    parts.push(`${day.counts.nappy} napp${day.counts.nappy !== 1 ? 'ies' : 'y'}${nappyParts ? ` (${nappyParts})` : ''}`);
  }
  if (day.counts.sleep > 0 || day.totalSleepMins > 0) {
    parts.push(day.totalSleepMins > 0 ? `${formatSleepDuration(day.totalSleepMins)} sleep` : `${day.counts.sleep} sleep session${day.counts.sleep !== 1 ? 's' : ''}`);
  }

  if (parts.length === 0) return `${day.dateKey}: No activities logged.`;

  return `${day.dateKey}: ${parts.join(', ')}.`;
}

export function formatTodaySnapshot(
  events: DailyEvent[],
  lastByType: Partial<Record<EventType, DailyEvent>>,
  latestMilestone: Milestone | null,
  currentDate: string,
  childName: string,
): string {
  const days = buildEventDays(events);
  const today = days.find((d) => d.dateKey === currentDate) ?? emptyDay(currentDate);

  const lines: string[] = [];
  lines.push(formatDaySummary(today, childName));

  const openSleep = events.find(
    (e) => e.type === 'sleep' && !e.metadata.sleepEnd,
  );
  if (openSleep) {
    lines.push(`Currently asleep since ${formatEventTime(openSleep)}.`);
  } else {
    lines.push('Currently awake.');
  }

  for (const type of ['meal', 'nappy', 'sleep'] as EventType[]) {
    const last = lastByType[type];
    if (last) {
      lines.push(`Last ${type}: ${formatEventTime(last)} — ${getEventDetail(last)}.`);
    }
  }

  if (latestMilestone) {
    lines.push(`Latest milestone: "${latestMilestone.title}" (${latestMilestone.category}) on ${latestMilestone.achieved_at}.`);
  }

  return lines.join(' ');
}

export function formatPeriodSummary(
  events: DailyEvent[],
  days: number,
  focus?: EventType,
): string {
  const eventDays = buildEventDays(events);
  if (eventDays.length === 0) return `No activities logged in the last ${days} days.`;

  const lines: string[] = [`Last ${days} days (${eventDays.length} days with activity):`];

  for (const day of eventDays.slice(0, 14)) {
    if (focus === 'meal') {
      lines.push(`  ${day.dateKey}: ${day.counts.meal} meals, ${day.totalMl}ml total`);
    } else if (focus === 'sleep') {
      lines.push(`  ${day.dateKey}: ${formatSleepDuration(day.totalSleepMins)} sleep (${day.counts.sleep} sessions)`);
    } else if (focus === 'nappy') {
      lines.push(`  ${day.dateKey}: ${day.counts.nappy} nappies`);
    } else {
      lines.push(`  ${formatDaySummary(day)}`);
    }
  }

  if (eventDays.length > 14) {
    lines.push(`  … and ${eventDays.length - 14} more days`);
  }

  const totalMl = eventDays.reduce((s, d) => s + d.totalMl, 0);
  const totalSleep = eventDays.reduce((s, d) => s + d.totalSleepMins, 0);
  const totalNappies = eventDays.reduce((s, d) => s + d.counts.nappy, 0);
  const totalMeals = eventDays.reduce((s, d) => s + d.counts.meal, 0);
  const activeDays = eventDays.length;

  lines.push(
    `Totals: ${totalMeals} meals (${totalMl}ml), ${totalNappies} nappies, ${formatSleepDuration(totalSleep)} sleep across ${activeDays} days.`,
  );

  return lines.join('\n');
}

export function formatMilestonesList(milestones: Milestone[]): string {
  if (milestones.length === 0) return 'No milestones found.';
  return milestones
    .map((m) => `- ${m.achieved_at}: ${m.title} (${m.category})${m.description ? ` — ${m.description}` : ''}`)
    .join('\n');
}

export function formatMemoriesList(memories: Memory[]): string {
  if (memories.length === 0) return 'No memories found.';
  return memories
    .map((m) => `- ${m.occurred_at}: ${m.title}${m.description ? ` — ${m.description}` : ''}`)
    .join('\n');
}

export function formatEventsList(events: DailyEvent[]): string {
  if (events.length === 0) return 'No events found.';
  return events
    .map((e) => `- ${formatEventTime(e)} ${formatEventSummary(e)}`)
    .join('\n');
}
