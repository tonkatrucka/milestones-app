import { useCallback, useEffect, useState } from 'react';
import type { GrowthEntry } from '@/lib/database.types';
import { getGrowthEntries } from '@/services/growth';

export function useGrowth(childId: string | null) {
  const [entries, setEntries] = useState<GrowthEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!childId) { setEntries([]); return; }
    setIsLoading(true);
    try {
      const data = await getGrowthEntries(childId);
      setEntries(data);
    } finally {
      setIsLoading(false);
    }
  }, [childId]);

  useEffect(() => { refresh(); }, [refresh]);

  const addEntry = useCallback((entry: GrowthEntry) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = entry;
        return next.sort((a, b) => b.measured_at.localeCompare(a.measured_at));
      }
      return [entry, ...prev].sort((a, b) => b.measured_at.localeCompare(a.measured_at));
    });
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { entries, isLoading, refresh, addEntry, removeEntry };
}
