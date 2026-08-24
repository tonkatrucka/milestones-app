import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import {
  generateNarrative,
  getLatestWeeklyNarrative,
  getMonthlyRecaps,
} from '@/services/narratives';
import { getRecentEvents } from '@/services/events';
import {
  buildLocalWeeklyNarrative,
  currentMonthKey,
  formatMonthKeyLabel,
} from '@/lib/local-narrative';

export function useNarratives(childId: string | null, childName: string | null) {
  const [weekly, setWeekly] = useState<string | null>(null);
  const [monthly, setMonthly] = useState<string | null>(null);
  const [monthLabel, setMonthLabel] = useState(() => formatMonthKeyLabel(currentMonthKey()));
  const [isGeneratingWeekly, setIsGeneratingWeekly] = useState(false);
  const [isGeneratingMonthly, setIsGeneratingMonthly] = useState(false);

  const refresh = useCallback(async () => {
    if (!childId || !childName) {
      setWeekly(null);
      setMonthly(null);
      return;
    }

    const [aiWeekly, recaps, events] = await Promise.all([
      getLatestWeeklyNarrative(childId),
      getMonthlyRecaps(childId),
      getRecentEvents(childId, 7).catch(() => []),
    ]);

    setWeekly(aiWeekly?.narrative ?? buildLocalWeeklyNarrative(childName, events));

    const key = currentMonthKey();
    const matching = recaps.find((r) => r.month_key === key) ?? recaps[0] ?? null;
    if (matching) {
      setMonthly(matching.narrative);
      setMonthLabel(formatMonthKeyLabel(matching.month_key));
    } else {
      setMonthly(null);
      setMonthLabel(formatMonthKeyLabel(key));
    }
  }, [childId, childName]);

  useEffect(() => {
    void Promise.resolve().then(() => refresh());
  }, [refresh]);

  const generateWeekly = useCallback(async () => {
    if (!childId) return;
    setIsGeneratingWeekly(true);
    try {
      const narrative = await generateNarrative({ childId, kind: 'weekly' });
      if (narrative) setWeekly(narrative);
    } catch (e) {
      Alert.alert(
        'Could not write this week yet',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setIsGeneratingWeekly(false);
    }
  }, [childId]);

  const generateMonthly = useCallback(async () => {
    if (!childId) return;
    setIsGeneratingMonthly(true);
    try {
      const narrative = await generateNarrative({ childId, kind: 'monthly' });
      if (narrative) {
        setMonthly(narrative);
        setMonthLabel(formatMonthKeyLabel(currentMonthKey()));
      }
    } catch (e) {
      Alert.alert(
        'Could not write this month yet',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setIsGeneratingMonthly(false);
    }
  }, [childId]);

  return {
    weekly,
    monthly,
    monthLabel,
    isGeneratingWeekly,
    isGeneratingMonthly,
    refresh,
    generateWeekly,
    generateMonthly,
  };
}
