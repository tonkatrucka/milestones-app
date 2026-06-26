import { useThemeStore, type ColorSchemePreference } from '@/store/theme-store';

export type { ColorSchemePreference };

export function useColorScheme(): ColorSchemePreference {
  const colorScheme = useThemeStore((s) => s.colorScheme);
  const hasHydrated = useThemeStore((s) => s.hasHydrated);

  if (!hasHydrated) {
    return 'light';
  }

  return colorScheme;
}
