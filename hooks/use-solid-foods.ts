import { useCallback, useEffect, useState } from 'react';
import type { SolidFood } from '@/lib/database.types';
import { getSolidFoods } from '@/services/solid-foods';

export function useSolidFoods(childId: string | null) {
  const [foods, setFoods] = useState<SolidFood[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!childId) { setFoods([]); return; }
    setIsLoading(true);
    try {
      setFoods(await getSolidFoods(childId));
    } finally {
      setIsLoading(false);
    }
  }, [childId]);

  useEffect(() => { refresh(); }, [refresh]);

  const addFood = useCallback((food: SolidFood) => {
    setFoods((prev) => [food, ...prev]);
  }, []);

  const removeFood = useCallback((id: string) => {
    setFoods((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const updateFood = useCallback((updated: SolidFood) => {
    setFoods((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
  }, []);

  return { foods, isLoading, refresh, addFood, removeFood, updateFood };
}
