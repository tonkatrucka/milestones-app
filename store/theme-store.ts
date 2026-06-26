import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ColorSchemePreference = 'light' | 'dark';

interface ThemeStore {
  colorScheme: ColorSchemePreference;
  hasHydrated: boolean;
  setColorScheme: (scheme: ColorSchemePreference) => void;
  setHasHydrated: (hydrated: boolean) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      colorScheme: 'light',
      hasHydrated: false,
      setColorScheme: (colorScheme) => set({ colorScheme }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'milestones-theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ colorScheme: state.colorScheme }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
