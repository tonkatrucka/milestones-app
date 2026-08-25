import { Colors, type AppPalette } from '@/constants/theme';
import { useColorScheme, type ColorSchemePreference } from '@/hooks/use-color-scheme';

export function useThemeColor(
  props: Partial<Record<ColorSchemePreference, string>>,
  colorName: keyof AppPalette,
) {
  const theme = useColorScheme();
  // `night` is a dark variant, so callers that only supply light/dark overrides
  // should still get their dark value rather than falling through to undefined.
  const colorFromProps = props[theme] ?? (theme === 'night' ? props.dark : undefined);

  if (colorFromProps) {
    return colorFromProps;
  }

  return Colors[theme][colorName];
}
