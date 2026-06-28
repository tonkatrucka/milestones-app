import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from "expo-router/react-navigation";
import {
  fetchInsights,
  localInsightDateString,
  resolveUserRegion,
  type InsightsPayload,
} from '@/services/insights';

export function useInsights(
  child: { id: string; name: string; date_of_birth: string } | null,
) {
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userRegionRef = useRef(resolveUserRegion());
  const currentDateRef = useRef(localInsightDateString());

  const load = useCallback(async () => {
    if (!child) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchInsights(
        child,
        userRegionRef.current,
        currentDateRef.current,
      );
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load insights');
    } finally {
      setIsLoading(false);
    }
  }, [child]);

  useEffect(() => {
    currentDateRef.current = localInsightDateString();
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = useCallback(() => load(), [load]);

  return { data, isLoading, error, refresh, userRegion: userRegionRef.current };
}
