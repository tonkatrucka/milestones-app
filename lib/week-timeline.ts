import { addDays, format, parseISO, startOfDay } from 'date-fns';
import type { DailyEvent, EventType, SleepMetadata } from '@/lib/database.types';

const MINUTES_PER_DAY = 1440;

export interface WeekPointItem {
  kind: 'point';
  id: string;
  type: EventType | 'wakeUp';
  event?: DailyEvent;
  occurredAt: string;
  minutes: number;
  overlapIndex: number;
}

export interface WeekSleepSegment {
  kind: 'sleepSegment';
  id: string;
  event: DailyEvent;
  startMinutes: number;
  endMinutes: number;
}

export type WeekTimelineItem = WeekPointItem | WeekSleepSegment;

export interface WeekDay {
  dateKey: string;
  shortLabel: string;
  dateLabel: string;
  isToday: boolean;
  items: WeekTimelineItem[];
}

export function minutesSinceMidnight(iso: string): number {
  const d = parseISO(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function clampToDay(minutes: number): number {
  return Math.max(0, Math.min(MINUTES_PER_DAY, minutes));
}

function dateKeyFromDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function generateWeekDateKeys(now: Date): string[] {
  const today = startOfDay(now);
  const keys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    keys.push(dateKeyFromDate(addDays(today, -i)));
  }
  return keys;
}

const OVERLAP_SLOT_COUNT = 5;

function assignOverlapIndices(items: WeekTimelineItem[]): WeekTimelineItem[] {
  const points = items
    .filter((i): i is WeekPointItem => i.kind === 'point')
    .sort((a, b) => a.minutes - b.minutes);

  for (let i = 0; i < points.length; i++) {
    let overlapIndex = 0;
    for (let j = 0; j < i; j++) {
      if (Math.abs(points[i].minutes - points[j].minutes) <= 20) {
        overlapIndex = (points[j].overlapIndex + 1) % OVERLAP_SLOT_COUNT;
        break;
      }
    }
    points[i].overlapIndex = overlapIndex;
  }

  return items;
}

function addPoint(
  dayItems: Map<string, WeekTimelineItem[]>,
  dateKey: string,
  item: Omit<WeekPointItem, 'overlapIndex'>,
) {
  if (!dayItems.has(dateKey)) dayItems.set(dateKey, []);
  dayItems.get(dateKey)!.push({ ...item, overlapIndex: 0 });
}

function addSleepSegment(
  dayItems: Map<string, WeekTimelineItem[]>,
  dateKey: string,
  segment: WeekSleepSegment,
) {
  if (!dayItems.has(dateKey)) dayItems.set(dateKey, []);
  dayItems.get(dateKey)!.push(segment);
}

export function buildWeekDays(events: DailyEvent[], now = new Date()): WeekDay[] {
  const weekKeys = generateWeekDateKeys(now);
  const weekKeySet = new Set(weekKeys);
  const todayKey = dateKeyFromDate(startOfDay(now));
  const dayItems = new Map<string, WeekTimelineItem[]>();

  for (const key of weekKeys) {
    dayItems.set(key, []);
  }

  for (const event of events) {
    const eventDateKey = format(parseISO(event.occurred_at), 'yyyy-MM-dd');

    if (event.type === 'sleep') {
      const meta = event.metadata as Partial<SleepMetadata>;
      const startMinutes = minutesSinceMidnight(event.occurred_at);
      const startDateKey = eventDateKey;

      if (typeof meta.sleepEnd === 'string') {
        const endDate = parseISO(meta.sleepEnd);
        const endDateKey = format(endDate, 'yyyy-MM-dd');
        const endMinutes = minutesSinceMidnight(meta.sleepEnd);

        if (startDateKey === endDateKey) {
          if (weekKeySet.has(startDateKey)) {
            addSleepSegment(dayItems, startDateKey, {
              kind: 'sleepSegment',
              id: `${event.id}-sleep`,
              event,
              startMinutes,
              endMinutes,
            });
          }
        } else {
          if (weekKeySet.has(startDateKey)) {
            addSleepSegment(dayItems, startDateKey, {
              kind: 'sleepSegment',
              id: `${event.id}-sleep-start`,
              event,
              startMinutes,
              endMinutes: MINUTES_PER_DAY,
            });
          }
          if (weekKeySet.has(endDateKey)) {
            addSleepSegment(dayItems, endDateKey, {
              kind: 'sleepSegment',
              id: `${event.id}-sleep-end`,
              event,
              startMinutes: 0,
              endMinutes,
            });
            addPoint(dayItems, endDateKey, {
              kind: 'point',
              id: `${event.id}-wake`,
              type: 'wakeUp',
              event,
              occurredAt: meta.sleepEnd,
              minutes: endMinutes,
            });
          }
        }
      } else if (weekKeySet.has(startDateKey)) {
        addSleepSegment(dayItems, startDateKey, {
          kind: 'sleepSegment',
          id: `${event.id}-sleep-ongoing`,
          event,
          startMinutes,
          endMinutes: MINUTES_PER_DAY,
        });
      }
      continue;
    }

    if (!weekKeySet.has(eventDateKey)) continue;

    addPoint(dayItems, eventDateKey, {
      kind: 'point',
      id: event.id,
      type: event.type as EventType,
      event,
      occurredAt: event.occurred_at,
      minutes: minutesSinceMidnight(event.occurred_at),
    });
  }

  return weekKeys.map((dateKey) => {
    const date = parseISO(`${dateKey}T12:00:00`);
    const items = assignOverlapIndices(dayItems.get(dateKey) ?? []);
    return {
      dateKey,
      shortLabel: format(date, 'EEE'),
      dateLabel: format(date, 'd MMM'),
      isToday: dateKey === todayKey,
      items,
    };
  });
}

export function weekHasEvents(weekDays: WeekDay[]): boolean {
  return weekDays.some((d) => d.items.length > 0);
}
