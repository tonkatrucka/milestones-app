import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useAppColors() {
  const scheme = useColorScheme();
  return Colors[scheme];
}
