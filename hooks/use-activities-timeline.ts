import { useCallback, useEffect, useState } from 'react';
import { getRecentEvents } from '@/services/events';
import {
  buildActivitiesSections,
  type ActivitiesMonthSection,
} from '@/lib/timeline-sections';
import { buildWeekDays, type WeekDay } from '@/lib/week-timeline';

export type { EventDay, ActivitiesMonthSection } from '@/lib/timeline-sections';
export type { WeekDay } from '@/lib/week-timeline';

export function useActivitiesTimeline(childId: string | null, childDob: string | null) {
  const [sections, setSections] = useState<ActivitiesMonthSection[]>([]);
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!childId || !childDob) {
      setSections([]);
      setWeekDays([]);
      return;
    }
    setIsLoading(true);
    try {
      const events = await getRecentEvents(childId, 180);
      setSections(buildActivitiesSections(events, childDob));
      setWeekDays(buildWeekDays(events));
    } catch (e) {
      console.error('[useActivitiesTimeline] fetch failed:', e);
    } finally {
      setIsLoading(false);
    }
  }, [childId, childDob]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { sections, weekDays, isLoading, refresh };
}
