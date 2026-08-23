import { useThemeStore, type ColorSchemePreference } from '@/store/theme-store';

export type { ColorSchemePreference };

/**
 * Maps the app's three schemes onto the light/dark pair that native components
 * (for example DateTimePicker's `themeVariant`) accept. `night` renders as dark.
 */
export function nativeThemeVariant(scheme: ColorSchemePreference): 'light' | 'dark' {
  return scheme === 'light' ? 'light' : 'dark';
}

export function useColorScheme(): ColorSchemePreference {
  const colorScheme = useThemeStore((s) => s.colorScheme);
  const hasHydrated = useThemeStore((s) => s.hasHydrated);

  if (!hasHydrated) {
    return 'light';
  }

  if (colorScheme === 'dark' || colorScheme === 'night') {
    return colorScheme;
  }

  return 'light';
}
