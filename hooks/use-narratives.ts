import { useCallback, useEffect, useState } from 'react';
import { getLatestWeeklyNarrative, getMonthlyRecaps } from '@/services/narratives';
import { getRecentEvents } from '@/services/events';
import {
  buildLocalWeeklyNarrative,
  currentMonthKey,
  formatMonthKeyLabel,
} from '@/lib/local-narrative';
import type { MonthlyRecap } from '@/lib/database.types';

export function useNarratives(childId: string | null, childName: string | null) {
  const [weekly, setWeekly] = useState<string | null>(null);
  const [monthly, setMonthly] = useState<string | null>(null);
  const [recaps, setRecaps] = useState<MonthlyRecap[]>([]);
  const [monthLabel, setMonthLabel] = useState(() => formatMonthKeyLabel(currentMonthKey()));

  const refresh = useCallback(async () => {
    if (!childId || !childName) {
      setWeekly(null);
      setMonthly(null);
      setRecaps([]);
      return;
    }

    const [aiWeekly, fetchedRecaps, events] = await Promise.all([
      getLatestWeeklyNarrative(childId),
      getMonthlyRecaps(childId),
      getRecentEvents(childId, 7).catch(() => []),
    ]);

    setWeekly(aiWeekly?.narrative ?? buildLocalWeeklyNarrative(childName, events));
    setRecaps(fetchedRecaps);

    const key = currentMonthKey();
    const matching = fetchedRecaps.find((r) => r.month_key === key) ?? null;
    setMonthly(matching?.narrative ?? null);
    setMonthLabel(formatMonthKeyLabel(key));
  }, [childId, childName]);

  useEffect(() => {
    void Promise.resolve().then(() => refresh());
  }, [refresh]);

  return {
    weekly,
    monthly,
    recaps,
    monthLabel,
    refresh,
  };
}
