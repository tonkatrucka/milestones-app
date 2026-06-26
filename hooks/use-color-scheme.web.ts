import { useThemeStore, type ColorSchemePreference } from '@/store/theme-store';

export type { ColorSchemePreference };

/**
 * On web, use the persisted preference once the store has rehydrated.
 */
export function useColorScheme(): ColorSchemePreference {
  const colorScheme = useThemeStore((s) => s.colorScheme);
  const hasHydrated = useThemeStore((s) => s.hasHydrated);

  if (!hasHydrated) {
    return 'light';
  }

  return colorScheme;
}
