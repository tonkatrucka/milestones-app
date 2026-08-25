import { useCallback, useEffect, useState } from 'react';
import type { VaccinationRecord } from '@/lib/database.types';
import { getVaccinations } from '@/services/vaccinations';

export function useVaccinations(childId: string | null) {
  const [records, setRecords] = useState<VaccinationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!childId) { setRecords([]); return; }
    setIsLoading(true);
    try {
      setRecords(await getVaccinations(childId));
    } finally {
      setIsLoading(false);
    }
  }, [childId]);

  useEffect(() => { refresh(); }, [refresh]);

  const addRecord = useCallback((record: VaccinationRecord) => {
    setRecords((prev) => [record, ...prev]);
  }, []);

  const removeRecord = useCallback((id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { records, isLoading, refresh, addRecord, removeRecord };
}
