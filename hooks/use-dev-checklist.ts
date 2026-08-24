import { useCallback, useEffect, useState } from 'react';
import type { DevChecklistEntry, DevChecklistStatus } from '@/lib/database.types';
import { getDevChecklist, upsertChecklistEntry } from '@/services/dev-checklist';

export function useDevChecklist(childId: string | null) {
  const [entries, setEntries] = useState<DevChecklistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!childId) {
      setEntries([]);
      return;
    }
    setIsLoading(true);
    try {
      setEntries(await getDevChecklist(childId));
    } finally {
      setIsLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setStatus = useCallback(
    async (checkpointId: string, status: DevChecklistStatus) => {
      if (!childId) return;
      let rolledBack: DevChecklistEntry[] = [];
      setEntries((current) => {
        rolledBack = current;
        const existing = current.find((entry) => entry.checkpoint_id === checkpointId);
        return [
          ...current.filter((entry) => entry.checkpoint_id !== checkpointId),
          {
            child_id: childId,
            checkpoint_id: checkpointId,
            status,
            noted_at: new Date().toISOString().split('T')[0],
            notes: existing?.notes ?? null,
          },
        ];
      });
      try {
        const saved = await upsertChecklistEntry({ childId, checkpointId, status });
        setEntries((current) => [
          ...current.filter((entry) => entry.checkpoint_id !== checkpointId),
          saved,
        ]);
      } catch (error) {
        setEntries(rolledBack);
        throw error;
      }
    },
    [childId],
  );

  return { entries, isLoading, refresh, setStatus };
}
