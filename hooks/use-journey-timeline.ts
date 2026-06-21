import { useCallback, useEffect, useState } from 'react';
import { format, parseISO, differenceInMonths, differenceInYears } from 'date-fns';
import { getMilestones } from '@/services/milestones';
import { getRecentEvents } from '@/services/events';
import { getMemories } from '@/services/memories';
import type { DailyEvent, EventType, Milestone, Memory } from '@/lib/database.types';

export interface EventDay {
  dateKey: string;                    // "2025-06-15"
  label: string;                      // "Sun 15 Jun"
  events: DailyEvent[];
  counts: Record<EventType, number>;
  totalMl: number;                    // sum of all meal amountMl for the day
  totalSleepMins: number;             // sum of all completed sleep durations (mins)
  wakeUps: string[];                  // ISO timestamps of wake-ups (from prev-day sleepEnd)
}

export interface MonthSection {
  monthKey: string;                   // "2025-06"
  label: string;                      // "June 2025"
  ageLabel: string;                   // "6mo" | "1yr 2mo"
  milestones: Milestone[];
  memories: Memory[];
  eventDays: EventDay[];
}

function formatAge(dob: string, date: Date): string {
  const birth = new Date(dob);
  const months = differenceInMonths(date, birth);
  const years = differenceInYears(date, birth);
  if (months < 1) return 'Newborn';
  if (years === 0) return `${months}mo`;
  const rem = months - years * 12;
  return rem === 0 ? `${years}yr` : `${years}yr ${rem}mo`;
}

function buildSections(
  milestones: Milestone[],
  events: DailyEvent[],
  memories: Memory[],
  childDob: string,
): MonthSection[] {
  const sectionMap = new Map<string, MonthSection>();

  const getOrCreate = (monthKey: string, date: Date): MonthSection => {
    if (!sectionMap.has(monthKey)) {
      sectionMap.set(monthKey, {
        monthKey,
        label: format(date, 'MMMM yyyy'),
        ageLabel: formatAge(childDob, date),
        milestones: [],
        memories: [],
        eventDays: [],
      });
    }
    return sectionMap.get(monthKey)!;
  };

  for (const m of milestones) {
    const date = parseISO(m.achieved_at);
    getOrCreate(format(date, 'yyyy-MM'), date).milestones.push(m);
  }

  for (const mem of memories) {
    const date = parseISO(mem.occurred_at);
    getOrCreate(format(date, 'yyyy-MM'), date).memories.push(mem);
  }

  // Group events by day first, then attach to month sections
  const dayMap = new Map<string, EventDay>();
  for (const e of events) {
    const date = parseISO(e.occurred_at);
    const dateKey = format(date, 'yyyy-MM-dd');
    const monthKey = dateKey.slice(0, 7);

    getOrCreate(monthKey, date);

    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, {
        dateKey,
        label: format(date, 'EEE d MMM'),
        events: [],
        counts: { nappy: 0, meal: 0, sleep: 0 },
        totalMl: 0,
        totalSleepMins: 0,
        wakeUps: [],
      });
    }
    const day = dayMap.get(dateKey)!;
    day.events.push(e);
    day.counts[e.type as EventType] = (day.counts[e.type as EventType] ?? 0) + 1;

    // Accumulate ml consumed
    if (e.type === 'meal') {
      const ml = (e.metadata as Record<string, unknown>)?.amountMl;
      if (typeof ml === 'number') day.totalMl += ml;
    }

    // Accumulate completed sleep durations
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

  // Second pass: for night sleeps that cross midnight, add a wake-up timestamp
  // to the day the child woke up (sleepEnd date ≠ occurred_at date).
  for (const e of events) {
    if (e.type !== 'sleep') continue;
    const sleepEnd = (e.metadata as Record<string, unknown>)?.sleepEnd;
    if (typeof sleepEnd !== 'string') continue;
    const startDateKey = format(parseISO(e.occurred_at), 'yyyy-MM-dd');
    const endDateKey   = format(parseISO(sleepEnd),       'yyyy-MM-dd');
    if (endDateKey === startDateKey) continue;
    if (!dayMap.has(endDateKey)) {
      const wakeDate = parseISO(sleepEnd);
      const wakeMonthKey = format(wakeDate, 'yyyy-MM');
      getOrCreate(wakeMonthKey, wakeDate);
      dayMap.set(endDateKey, {
        dateKey: endDateKey,
        label: format(wakeDate, 'EEE d MMM'),
        events: [],
        counts: { nappy: 0, meal: 0, sleep: 0 },
        totalMl: 0,
        totalSleepMins: 0,
        wakeUps: [],
      });
    }
    dayMap.get(endDateKey)!.wakeUps.push(sleepEnd);
  }

  for (const day of dayMap.values()) {
    const section = sectionMap.get(day.dateKey.slice(0, 7));
    if (section) section.eventDays.push(day);
  }

  const sections = Array.from(sectionMap.values()).sort((a, b) =>
    b.monthKey.localeCompare(a.monthKey),
  );

  for (const s of sections) {
    s.milestones.sort(
      (a, b) => parseISO(b.achieved_at).getTime() - parseISO(a.achieved_at).getTime(),
    );
    s.memories.sort(
      (a, b) => parseISO(b.occurred_at).getTime() - parseISO(a.occurred_at).getTime(),
    );
    s.eventDays.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    for (const d of s.eventDays) {
      d.events.sort(
        (a, b) => parseISO(b.occurred_at).getTime() - parseISO(a.occurred_at).getTime(),
      );
    }
  }

  return sections;
}

export function useJourneyTimeline(childId: string | null, childDob: string | null) {
  const [sections, setSections] = useState<MonthSection[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!childId || !childDob) {
      setSections([]);
      return;
    }
    setIsLoading(true);
    try {
      const [milestones, events, memories] = await Promise.all([
        getMilestones(childId),
        getRecentEvents(childId, 180),
        getMemories(childId),
      ]);
      setSections(buildSections(milestones, events, memories, childDob));
    } catch (e) {
      console.error('[useJourneyTimeline] fetch failed:', e);
    } finally {
      setIsLoading(false);
    }
  }, [childId, childDob]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { sections, isLoading, refresh };
}
