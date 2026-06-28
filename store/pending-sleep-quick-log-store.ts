import { create } from 'zustand';

interface PendingSleepQuickLogStore {
  pending: boolean;
  setPending: (pending: boolean) => void;
}

export const usePendingSleepQuickLogStore = create<PendingSleepQuickLogStore>((set) => ({
  pending: false,
  setPending: (pending) => set({ pending }),
}));
