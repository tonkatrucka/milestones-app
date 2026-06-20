import { useCallback, useEffect, useState } from 'react';
import type { DailyEvent, EventType } from '@/lib/database.types';
import { getTodayEvents, getLastEventByType } from '@/services/events';

interface LastEvents {
  nappy: DailyEvent | null;
  meal: DailyEvent | null;
  sleep: DailyEvent | null;
}

export function useDailyEvents(childId: string | null) {
  const [todayEvents, setTodayEvents] = useState<DailyEvent[]>([]);
  const [yesterdayEvents, setYesterdayEvents] = useState<DailyEvent[]>([]);
  const [lastEvents, setLastEvents] = useState<LastEvents>({
    nappy: null,
    meal: null,
    sleep: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!childId) return;
    setIsLoading(true);
    try {
      const [today, yesterday, nappy, meal, sleep] = await Promise.all([
        getTodayEvents(childId, 0),
        getTodayEvents(childId, 1),
        getLastEventByType(childId, 'nappy'),
        getLastEventByType(childId, 'meal'),
        getLastEventByType(childId, 'sleep'),
      ]);
      setTodayEvents(today);
      setYesterdayEvents(yesterday);
      setLastEvents({ nappy, meal, sleep });
    } finally {
      setIsLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addEvent = useCallback((event: DailyEvent) => {
    setTodayEvents((prev) => [event, ...prev]);
    setLastEvents((prev) => ({ ...prev, [event.type]: event }));
  }, []);

  return { todayEvents, yesterdayEvents, lastEvents, isLoading, refresh, addEvent };
}

export function useLastEventForType(childId: string | null, type: EventType) {
  const [event, setEvent] = useState<DailyEvent | null>(null);

  useEffect(() => {
    if (!childId) return;
    getLastEventByType(childId, type).then(setEvent).catch(() => null);
  }, [childId, type]);

  return event;
}
