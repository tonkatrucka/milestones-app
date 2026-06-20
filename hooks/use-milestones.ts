import { useCallback, useEffect, useState } from 'react';
import type { Milestone } from '@/lib/database.types';
import { getMilestones } from '@/services/milestones';

export function useMilestones(childId: string | null) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!childId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMilestones(childId);
      setMilestones(data);
    } catch (e) {
      setError('Failed to load milestones');
    } finally {
      setIsLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addMilestone = useCallback((milestone: Milestone) => {
    setMilestones((prev) => [milestone, ...prev]);
  }, []);

  const removeMilestone = useCallback((id: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const updateMilestone = useCallback((updated: Milestone) => {
    setMilestones((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }, []);

  return { milestones, isLoading, error, refresh, addMilestone, removeMilestone, updateMilestone };
}
