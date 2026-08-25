import { useCallback, useEffect, useState } from 'react';
import type { ParentCheckin } from '@/lib/database.types';
import { getTodayCheckin, getRecentCheckins } from '@/services/wellbeing';

export function useWellbeing(userId: string | null, childId: string | null) {
  const [todayCheckin, setTodayCheckin] = useState<ParentCheckin | null>(null);
  const [recentCheckins, setRecentCheckins] = useState<ParentCheckin[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId || !childId) {
      setTodayCheckin(null);
      setRecentCheckins([]);
      return;
    }
    setIsLoading(true);
    try {
      const [today, recent] = await Promise.all([
        getTodayCheckin(userId, childId),
        getRecentCheckins(userId, childId, 30),
      ]);
      setTodayCheckin(today);
      setRecentCheckins(recent);
    } finally {
      setIsLoading(false);
    }
  }, [userId, childId]);

  useEffect(() => { refresh(); }, [refresh]);

  const setCheckin = useCallback((checkin: ParentCheckin) => {
    setTodayCheckin(checkin);
    setRecentCheckins((prev) => {
      const idx = prev.findIndex((c) => c.id === checkin.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = checkin;
        return next;
      }
      return [checkin, ...prev];
    });
  }, []);

  return { todayCheckin, recentCheckins, isLoading, refresh, setCheckin };
}
