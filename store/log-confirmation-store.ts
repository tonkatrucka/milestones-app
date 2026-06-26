import { create } from 'zustand';
import type { DailyEvent } from '@/lib/database.types';

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LogConfirmationStore {
  pending: { event: DailyEvent; origin?: LayoutRect; key: number } | null;
  timelineTop: LayoutRect | null;
  confirmLog: (event: DailyEvent, origin?: LayoutRect) => void;
  setTimelineTop: (rect: LayoutRect | null) => void;
  clear: () => void;
}

export const useLogConfirmationStore = create<LogConfirmationStore>((set) => ({
  pending: null,
  timelineTop: null,
  confirmLog: (event, origin) => set({ pending: { event, origin, key: Date.now() } }),
  setTimelineTop: (timelineTop) => set({ timelineTop }),
  clear: () => set({ pending: null }),
}));
