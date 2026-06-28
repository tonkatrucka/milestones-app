import { create } from 'zustand';

interface PendingMealQuickLogStore {
  pending: boolean;
  setPending: (pending: boolean) => void;
}

export const usePendingMealQuickLogStore = create<PendingMealQuickLogStore>((set) => ({
  pending: false,
  setPending: (pending) => set({ pending }),
}));
