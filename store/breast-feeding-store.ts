import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BreastSide } from '@/lib/database.types';

export interface BreastFeedingSession {
  childId: string;
  startedAt: string;
  side: BreastSide;
}

interface BreastFeedingStore {
  session: BreastFeedingSession | null;
  setSession: (session: BreastFeedingSession | null) => void;
}

export const useBreastFeedingStore = create<BreastFeedingStore>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
    }),
    {
      name: 'milestones-breast-feeding',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
