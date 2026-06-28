import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface SleepTimerSession {
  childId: string;
  eventId: string;
  startedAt: string;
}

interface SleepTimerStore {
  session: SleepTimerSession | null;
  setSession: (session: SleepTimerSession | null) => void;
}

export const useSleepTimerStore = create<SleepTimerStore>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
    }),
    {
      name: 'milestones-sleep-timer',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
