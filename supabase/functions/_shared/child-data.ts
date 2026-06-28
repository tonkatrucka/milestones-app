import type { ParsedSimpleQuery } from '../chat/intent-parser.ts';
import {
  buildEventDays,
  formatDaySummary,
  formatEventsList,
  formatEventTime,
  formatMemoriesList,
  formatMilestonesList,
  formatPeriodSummary,
  formatTodaySnapshot,
  getEventDetail,
  type DailyEvent,
  type EventType,
  type Memory,
  type Milestone,
} from './record-format.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

function dayBounds(dateStr: string, isToday: boolean): { start: string; end: string } {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = isToday ? new Date() : new Date(`${dateStr}T23:59:59.999`);
  return { start: start.toISOString(), end: end.toISOString() };
}

function previousDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d - 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export async function fetchEventsForDate(
  adminDb: SupabaseClient,
  childId: string,
  dateStr: string,
  currentDate: string,
): Promise<DailyEvent[]> {
  const isToday = dateStr === currentDate;
  const { start, end } = dayBounds(dateStr, isToday);

  const { data, error } = await adminDb
    .from('daily_events')
    .select('*')
    .eq('child_id', childId)
    .gte('occurred_at', start)
    .lte('occurred_at', end)
    .order('occurred_at', { ascending: false });

  if (error) throw new Error(`fetchEventsForDate: ${error.message}`);
  return (data ?? []) as DailyEvent[];
}

export async function fetchTodayEvents(
  adminDb: SupabaseClient,
  childId: string,
  currentDate: string,
): Promise<DailyEvent[]> {
  return fetchEventsForDate(adminDb, childId, currentDate, currentDate);
}

export async function fetchRecentEvents(
  adminDb: SupabaseClient,
  childId: string,
  days: number,
): Promise<DailyEvent[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await adminDb
    .from('daily_events')
    .select('*')
    .eq('child_id', childId)
    .gte('occurred_at', since.toISOString())
    .order('occurred_at', { ascending: false });

  if (error) throw new Error(`fetchRecentEvents: ${error.message}`);
  return (data ?? []) as DailyEvent[];
}

export async function fetchLastEventByType(
  adminDb: SupabaseClient,
  childId: string,
  type: EventType,
): Promise<DailyEvent | null> {
  const { data, error } = await adminDb
    .from('daily_events')
    .select('*')
    .eq('child_id', childId)
    .eq('type', type)
    .lte('occurred_at', new Date().toISOString())
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`fetchLastEventByType: ${error.message}`);
  return data as DailyEvent | null;
}

export async function fetchLatestMilestone(
  adminDb: SupabaseClient,
  childId: string,
): Promise<Milestone | null> {
  const { data, error } = await adminDb
    .from('milestones')
    .select('*')
    .eq('child_id', childId)
    .order('achieved_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`fetchLatestMilestone: ${error.message}`);
  return data as Milestone | null;
}

export async function fetchMilestones(
  adminDb: SupabaseClient,
  childId: string,
  opts: { category?: string; startDate?: string; endDate?: string; limit?: number } = {},
): Promise<Milestone[]> {
  let query = adminDb
    .from('milestones')
    .select('*')
    .eq('child_id', childId)
    .order('achieved_at', { ascending: false })
    .limit(opts.limit ?? 20);

  if (opts.category) query = query.eq('category', opts.category);
  if (opts.startDate) query = query.gte('achieved_at', opts.startDate);
  if (opts.endDate) query = query.lte('achieved_at', opts.endDate);

  const { data, error } = await query;
  if (error) throw new Error(`fetchMilestones: ${error.message}`);
  return (data ?? []) as Milestone[];
}

export async function fetchMemories(
  adminDb: SupabaseClient,
  childId: string,
  opts: { startDate?: string; endDate?: string; limit?: number } = {},
): Promise<Memory[]> {
  let query = adminDb
    .from('memories')
    .select('*')
    .eq('child_id', childId)
    .order('occurred_at', { ascending: false })
    .limit(opts.limit ?? 20);

  if (opts.startDate) query = query.gte('occurred_at', opts.startDate);
  if (opts.endDate) query = query.lte('occurred_at', opts.endDate);

  const { data, error } = await query;
  if (error) throw new Error(`fetchMemories: ${error.message}`);
  return (data ?? []) as Memory[];
}

export async function buildTodaySnapshotText(
  adminDb: SupabaseClient,
  childId: string,
  childName: string,
  currentDate: string,
): Promise<string> {
  const [todayEvents, lastMeal, lastNappy, lastSleep, latestMilestone] = await Promise.all([
    fetchTodayEvents(adminDb, childId, currentDate),
    fetchLastEventByType(adminDb, childId, 'meal'),
    fetchLastEventByType(adminDb, childId, 'nappy'),
    fetchLastEventByType(adminDb, childId, 'sleep'),
    fetchLatestMilestone(adminDb, childId),
  ]);

  return formatTodaySnapshot(
    todayEvents,
    { meal: lastMeal ?? undefined, nappy: lastNappy ?? undefined, sleep: lastSleep ?? undefined },
    latestMilestone,
    currentDate,
    childName,
  );
}

export async function handleReadTool(
  toolName: string,
  input: Record<string, unknown>,
  adminDb: SupabaseClient,
  childId: string,
  currentDate: string,
): Promise<string> {
  switch (toolName) {
    case 'get_daily_summary': {
      const date = (input.date as string) ?? currentDate;
      const events = await fetchEventsForDate(adminDb, childId, date, currentDate);
      const days = buildEventDays(events);
      const day = days.find((d) => d.dateKey === date);
      if (!day || day.events.length === 0) return `${date}: No activities logged.`;
      return formatDaySummary(day);
    }

    case 'get_last_event': {
      const type = input.type as EventType;
      const event = await fetchLastEventByType(adminDb, childId, type);
      if (!event) return `No ${type} events logged yet.`;
      return `Last ${type}: ${formatEventTime(event)} — ${getEventDetail(event)}.`;
    }

    case 'get_events': {
      const days = Math.min(Number(input.days) || 7, 30);
      let events = await fetchRecentEvents(adminDb, childId, days);
      if (input.type) {
        events = events.filter((e) => e.type === input.type);
      }
      const limit = Math.min(Number(input.limit) || 30, 30);
      return formatEventsList(events.slice(0, limit));
    }

    case 'get_milestones': {
      const milestones = await fetchMilestones(adminDb, childId, {
        category: input.category as string | undefined,
        startDate: input.start_date as string | undefined,
        endDate: input.end_date as string | undefined,
        limit: Math.min(Number(input.limit) || 20, 20),
      });
      return formatMilestonesList(milestones);
    }

    case 'get_memories': {
      const memories = await fetchMemories(adminDb, childId, {
        startDate: input.start_date as string | undefined,
        endDate: input.end_date as string | undefined,
        limit: Math.min(Number(input.limit) || 20, 20),
      });
      return formatMemoriesList(memories);
    }

    case 'get_period_summary': {
      const days = Math.min(Number(input.days) || 7, 90);
      const events = await fetchRecentEvents(adminDb, childId, days);
      return formatPeriodSummary(events, days, input.focus as EventType | undefined);
    }

    default:
      return `Unknown read tool: ${toolName}`;
  }
}

function formatSleepDuration(mins: number): string {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins}m`;
}

export async function answerSimpleQuery(
  query: ParsedSimpleQuery,
  adminDb: SupabaseClient,
  childId: string,
  childName: string,
  currentDate: string,
): Promise<string> {
  const todayEvents = await fetchTodayEvents(adminDb, childId, currentDate);
  const today = buildEventDays(todayEvents).find((d) => d.dateKey === currentDate);

  const yesterdayDate = previousDate(currentDate);
  const yesterdayEvents = await fetchEventsForDate(adminDb, childId, yesterdayDate, currentDate);
  const yesterday = buildEventDays(yesterdayEvents).find((d) => d.dateKey === yesterdayDate);

  switch (query.queryType) {
    case 'nappy_count_today': {
      const count = today?.counts.nappy ?? 0;
      if (count === 0) return `No nappies logged for ${childName} today yet.`;
      const breakdown = today
        ? Object.entries(today.nappyByType).map(([t, n]) => `${n} ${t}`).join(', ')
        : '';
      return `${childName} has had ${count} napp${count !== 1 ? 'ies' : 'y'} today${breakdown ? ` (${breakdown})` : ''}.`;
    }

    case 'meal_count_today': {
      const count = today?.counts.meal ?? 0;
      if (count === 0) return `No feeds logged for ${childName} today yet.`;
      const ml = today?.totalMl ?? 0;
      return `${childName} has had ${count} feed${count !== 1 ? 's' : ''} today${ml > 0 ? ` (${ml}ml bottle total)` : ''}.`;
    }

    case 'milk_today': {
      const ml = today?.totalMl ?? 0;
      if (ml === 0) return `No bottle milk logged for ${childName} today yet.`;
      return `${childName} has had ${ml}ml from bottles today.`;
    }

    case 'sleep_today': {
      const mins = today?.totalSleepMins ?? 0;
      if (mins === 0) {
        const open = todayEvents.find((e) => e.type === 'sleep' && !e.metadata.sleepEnd);
        if (open) return `${childName} is currently asleep (since ${formatEventTime(open)}).`;
        return `No completed sleep logged for ${childName} today yet.`;
      }
      return `${childName} has slept ${formatSleepDuration(mins)} today so far.`;
    }

    case 'nappy_count_yesterday': {
      const count = yesterday?.counts.nappy ?? 0;
      if (count === 0) return `No nappies logged for ${childName} yesterday.`;
      const breakdown = yesterday
        ? Object.entries(yesterday.nappyByType).map(([t, n]) => `${n} ${t}`).join(', ')
        : '';
      return `${childName} had ${count} napp${count !== 1 ? 'ies' : 'y'} yesterday${breakdown ? ` (${breakdown})` : ''}.`;
    }

    case 'meal_count_yesterday': {
      const count = yesterday?.counts.meal ?? 0;
      if (count === 0) return `No feeds logged for ${childName} yesterday.`;
      const ml = yesterday?.totalMl ?? 0;
      return `${childName} had ${count} feed${count !== 1 ? 's' : ''} yesterday${ml > 0 ? ` (${ml}ml bottle total)` : ''}.`;
    }

    case 'milk_yesterday': {
      const ml = yesterday?.totalMl ?? 0;
      if (ml === 0) return `No bottle milk logged for ${childName} yesterday.`;
      return `${childName} had ${ml}ml from bottles yesterday.`;
    }

    case 'sleep_yesterday': {
      const mins = yesterday?.totalSleepMins ?? 0;
      if (mins === 0) return `No sleep logged for ${childName} yesterday.`;
      return `${childName} slept ${formatSleepDuration(mins)} yesterday.`;
    }

    case 'last_meal': {
      const event = await fetchLastEventByType(adminDb, childId, 'meal');
      if (!event) return `No feeds logged for ${childName} yet.`;
      return `The last feed was at ${formatEventTime(event)} — ${getEventDetail(event)}.`;
    }

    case 'last_nappy': {
      const event = await fetchLastEventByType(adminDb, childId, 'nappy');
      if (!event) return `No nappies logged for ${childName} yet.`;
      return `The last nappy change was at ${formatEventTime(event)} — ${getEventDetail(event)}.`;
    }

    case 'last_sleep': {
      const event = await fetchLastEventByType(adminDb, childId, 'sleep');
      if (!event) return `No sleep logged for ${childName} yet.`;
      const detail = getEventDetail(event);
      if (detail === 'Ongoing') {
        return `${childName} is currently asleep (since ${formatEventTime(event)}).`;
      }
      return `The last sleep was at ${formatEventTime(event)} — ${detail}.`;
    }

    case 'is_asleep': {
      const events = await fetchRecentEvents(adminDb, childId, 3);
      const open = events.find((e) => e.type === 'sleep' && !e.metadata.sleepEnd);
      if (open) return `Yes — ${childName} is asleep since ${formatEventTime(open)}.`;
      return `No — ${childName} is awake.`;
    }

    case 'today_summary': {
      const snapshot = await buildTodaySnapshotText(adminDb, childId, childName, currentDate);
      return `Here's how today is going for ${childName}: ${snapshot}`;
    }
  }
}
