import { use } from 'react';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';

/** Never throws if the tab bar context is missing on first paint. */
export function useSafeBottomTabBarHeight(fallback = 56): number {
  const height = use(BottomTabBarHeightContext);
  return typeof height === 'number' ? height : fallback;
}
