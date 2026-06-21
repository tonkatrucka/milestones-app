import { Platform } from 'react-native';

const primaryColor = '#E07A5F';
const secondaryColor = '#81B29A';

export const Colors = {
  light: {
    text: '#1C1C1E',
    background: '#FDF6EC',
    tint: primaryColor,
    icon: '#9E9E9E',
    tabIconDefault: '#B0B0B0',
    tabIconSelected: primaryColor,
    primary: primaryColor,
    secondary: secondaryColor,
    card: '#FFFFFF',
    border: '#EDE8E0',
    muted: '#9E9E9E',
    inputBackground: '#F5F0E8',
    danger: '#E53935',
  },
  dark: {
    text: '#F0EDE8',
    background: '#1C1A28',
    tint: primaryColor,
    icon: '#9BA1A6',
    tabIconDefault: '#5A5A6E',
    tabIconSelected: primaryColor,
    primary: primaryColor,
    secondary: secondaryColor,
    card: '#2A2838',
    border: '#3A3848',
    muted: '#6E6E82',
    inputBackground: '#34324A',
    danger: '#EF5350',
  },
};

export const EventColors = {
  nappy: '#7BAFD4',
  meal: '#E8A87C',
  sleep: '#9B8EC4',
} as const;

export const MilestoneColors = {
  language: '#F4A261',
  movement: '#2A9D8F',
  development: '#E76F51',
} as const;

export const MemoryColor = '#9B59B6';

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  android: {
    sans: 'sans-serif',
    serif: 'serif',
    // 'sans-serif-medium' is Roboto Medium — closest Android equivalent to a
    // rounded/display face for titles. Falls back to regular Roboto on older
    // devices, which is still clean and avoids the 'normal' rendering glitch.
    rounded: 'sans-serif-medium',
    mono: 'monospace',
  },
  default: {
    sans: 'sans-serif',
    serif: 'serif',
    rounded: 'sans-serif',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};
