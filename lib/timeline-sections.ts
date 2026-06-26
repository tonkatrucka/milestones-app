import { format, parseISO, differenceInMonths, differenceInYears } from 'date-fns';
import { calendarDateKey, parseCalendarDate } from '@/lib/calendar-date';
import type { DailyEvent, EventType, Milestone, Memory } from '@/lib/database.types';

// ─── Shared helpers ───────────────────────────────────────────────────────────

export function formatAge(dob: string, date: Date): string {
  const birth = parseCalendarDate(dob);
  const months = differenceInMonths(date, birth);
  const years = differenceInYears(date, birth);
  if (months < 1) return 'Newborn';
  if (years === 0) return `${months}mo`;
  const rem = months - years * 12;
  return rem === 0 ? `${years}yr` : `${years}yr ${rem}mo`;
}

// ─── Activities timeline ────────────────────────────────────────────────────────

export interface EventDay {
  dateKey: string;
  label: string;
  events: DailyEvent[];
  counts: Record<EventType, number>;
  totalMl: number;
  totalSleepMins: number;
  wakeUps: string[];
}

export interface ActivitiesMonthSection {
  monthKey: string;
  label: string;
  ageLabel: string;
  eventDays: EventDay[];
}

function emptyDay(dateKey: string, date: Date): EventDay {
  return {
    dateKey,
    label: format(date, 'EEE d MMM'),
    events: [],
    counts: { nappy: 0, meal: 0, sleep: 0 },
    totalMl: 0,
    totalSleepMins: 0,
    wakeUps: [],
  };
}

export function buildActivitiesSections(
  events: DailyEvent[],
  childDob: string,
): ActivitiesMonthSection[] {
  const sectionMap = new Map<string, ActivitiesMonthSection>();
  const dayMap = new Map<string, EventDay>();

  const getOrCreate = (monthKey: string, date: Date): ActivitiesMonthSection => {
    if (!sectionMap.has(monthKey)) {
      sectionMap.set(monthKey, {
        monthKey,
        label: format(date, 'MMMM yyyy'),
        ageLabel: formatAge(childDob, date),
        eventDays: [],
      });
    }
    return sectionMap.get(monthKey)!;
  };

  const ensureDay = (dateKey: string, date: Date): EventDay => {
    getOrCreate(dateKey.slice(0, 7), date);
    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, emptyDay(dateKey, date));
    }
    return dayMap.get(dateKey)!;
  };

  for (const e of events) {
    const date = parseISO(e.occurred_at);
    const dateKey = format(date, 'yyyy-MM-dd');
    const day = ensureDay(dateKey, date);

    day.events.push(e);
    day.counts[e.type as EventType] = (day.counts[e.type as EventType] ?? 0) + 1;

    if (e.type === 'meal') {
      const ml = (e.metadata as Record<string, unknown>)?.amountMl;
      if (typeof ml === 'number') day.totalMl += ml;
    }

    if (e.type === 'sleep') {
      const sleepEnd = (e.metadata as Record<string, unknown>)?.sleepEnd;
      if (typeof sleepEnd === 'string') {
        const mins = Math.round(
          (parseISO(sleepEnd).getTime() - parseISO(e.occurred_at).getTime()) / 60000,
        );
        if (mins > 0) day.totalSleepMins += mins;
      }
    }
  }

  for (const e of events) {
    if (e.type !== 'sleep') continue;
    const sleepEnd = (e.metadata as Record<string, unknown>)?.sleepEnd;
    if (typeof sleepEnd !== 'string') continue;
    const startDateKey = format(parseISO(e.occurred_at), 'yyyy-MM-dd');
    const endDateKey = format(parseISO(sleepEnd), 'yyyy-MM-dd');
    if (endDateKey === startDateKey) continue;
    const wakeDate = parseISO(sleepEnd);
    ensureDay(endDateKey, wakeDate).wakeUps.push(sleepEnd);
  }

  for (const day of dayMap.values()) {
    const section = sectionMap.get(day.dateKey.slice(0, 7));
    if (section) section.eventDays.push(day);
  }

  const sections = Array.from(sectionMap.values()).sort((a, b) =>
    b.monthKey.localeCompare(a.monthKey),
  );

  for (const s of sections) {
    s.eventDays.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    for (const d of s.eventDays) {
      d.events.sort(
        (a, b) => parseISO(b.occurred_at).getTime() - parseISO(a.occurred_at).getTime(),
      );
    }
  }

  return sections;
}

// ─── Journey timeline (milestones + memories) ─────────────────────────────────

export type JourneyEntry =
  | { kind: 'milestone'; dateKey: string; data: Milestone }
  | { kind: 'memory'; dateKey: string; data: Memory };

export interface JourneyMonthSection {
  monthKey: string;
  label: string;
  ageLabel: string;
  milestones: Milestone[];
  memories: Memory[];
  entries: JourneyEntry[];
}

export function buildJourneySections(
  milestones: Milestone[],
  memories: Memory[],
  childDob: string,
): JourneyMonthSection[] {
  const sectionMap = new Map<string, JourneyMonthSection>();

  const getOrCreate = (monthKey: string, date: Date): JourneyMonthSection => {
    if (!sectionMap.has(monthKey)) {
      sectionMap.set(monthKey, {
        monthKey,
        label: format(date, 'MMMM yyyy'),
        ageLabel: formatAge(childDob, date),
        milestones: [],
        memories: [],
        entries: [],
      });
    }
    return sectionMap.get(monthKey)!;
  };

  for (const m of milestones) {
    const date = parseCalendarDate(m.achieved_at);
    const dateKey = calendarDateKey(m.achieved_at);
    const section = getOrCreate(format(date, 'yyyy-MM'), date);
    section.milestones.push(m);
    section.entries.push({ kind: 'milestone', dateKey, data: m });
  }

  for (const mem of memories) {
    const date = parseCalendarDate(mem.occurred_at);
    const dateKey = calendarDateKey(mem.occurred_at);
    const section = getOrCreate(format(date, 'yyyy-MM'), date);
    section.memories.push(mem);
    section.entries.push({ kind: 'memory', dateKey, data: mem });
  }

  const sections = Array.from(sectionMap.values()).sort((a, b) =>
    b.monthKey.localeCompare(a.monthKey),
  );

  for (const s of sections) {
    s.milestones.sort(
      (a, b) =>
        parseCalendarDate(b.achieved_at).getTime() - parseCalendarDate(a.achieved_at).getTime(),
    );
    s.memories.sort(
      (a, b) =>
        parseCalendarDate(b.occurred_at).getTime() - parseCalendarDate(a.occurred_at).getTime(),
    );
    s.entries.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }

  return sections;
}
