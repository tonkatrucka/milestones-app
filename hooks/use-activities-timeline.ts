import { useCallback, useEffect, useState } from 'react';
import { getRecentEvents } from '@/services/events';
import {
  buildActivitiesSections,
  type ActivitiesMonthSection,
} from '@/lib/timeline-sections';

export type { EventDay, ActivitiesMonthSection } from '@/lib/timeline-sections';

export function useActivitiesTimeline(childId: string | null, childDob: string | null) {
  const [sections, setSections] = useState<ActivitiesMonthSection[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!childId || !childDob) {
      setSections([]);
      return;
    }
    setIsLoading(true);
    try {
      const events = await getRecentEvents(childId, 180);
      setSections(buildActivitiesSections(events, childDob));
    } catch (e) {
      console.error('[useActivitiesTimeline] fetch failed:', e);
    } finally {
      setIsLoading(false);
    }
  }, [childId, childDob]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { sections, isLoading, refresh };
}
