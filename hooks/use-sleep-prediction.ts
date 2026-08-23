import { useEffect, useState } from 'react';
import type { DailyEvent } from '@/lib/database.types';
import { analyseSleepPatterns, type NapPrediction } from '@/services/sleep-predictions';
import { scheduleNapAlert } from '@/services/local-notifications';

export function useSleepPrediction(recentEvents: DailyEvent[]) {
  const [prediction, setPrediction] = useState<NapPrediction | null>(null);

  useEffect(() => {
    if (recentEvents.length === 0) {
      setPrediction(null);
      return;
    }
    const p = analyseSleepPatterns(recentEvents);
    setPrediction(p);

    // Auto-schedule a nap alert when a high-confidence prediction is available
    if (p && p.confidence >= 60) {
      scheduleNapAlert({ predictedNapStart: p.nextNapStart }).catch(() => null);
    }
  }, [recentEvents]);

  return prediction;
}
