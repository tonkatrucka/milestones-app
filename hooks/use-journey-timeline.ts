import { useCallback, useEffect, useState } from 'react';
import { getMilestones } from '@/services/milestones';
import { getMemories } from '@/services/memories';
import { backfillChatPhotosForRecords } from '@/services/chat-media-link';
import {
  buildJourneySections,
  type JourneyMonthSection,
} from '@/lib/timeline-sections';

export type { JourneyEntry, JourneyMonthSection } from '@/lib/timeline-sections';

export function useJourneyTimeline(childId: string | null, childDob: string | null) {
  const [sections, setSections] = useState<JourneyMonthSection[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!childId || !childDob) {
      setSections([]);
      return;
    }
    setIsLoading(true);
    try {
      await backfillChatPhotosForRecords(childId).catch((e) =>
        console.error('[useJourneyTimeline] backfillChatPhotosForRecords failed:', e),
      );

      const [milestones, memories] = await Promise.all([
        getMilestones(childId),
        getMemories(childId),
      ]);
      setSections(buildJourneySections(milestones, memories, childDob));
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
