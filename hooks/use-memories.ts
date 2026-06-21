import { useCallback, useEffect, useState } from 'react';
import type { Memory } from '@/lib/database.types';
import { getMemories } from '@/services/memories';

export function useMemories(childId: string | null) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!childId) {
      setMemories([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMemories(childId);
      setMemories(data);
    } catch {
      setError('Failed to load memories');
    } finally {
      setIsLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addMemory = useCallback((memory: Memory) => {
    setMemories((prev) => [memory, ...prev].sort(
      (a, b) => b.occurred_at.localeCompare(a.occurred_at),
    ));
  }, []);

  const removeMemory = useCallback((id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const updateMemoryInList = useCallback((updated: Memory) => {
    setMemories((prev) =>
      prev
        .map((m) => (m.id === updated.id ? updated : m))
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
    );
  }, []);

  return { memories, isLoading, error, refresh, addMemory, removeMemory, updateMemoryInList };
}
