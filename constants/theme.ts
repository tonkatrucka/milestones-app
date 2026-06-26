import { Platform } from 'react-native';

import {
  PaletteAnchors,
  PaletteCool,
  PaletteGreen,
  PaletteNeutralsCool,
  PaletteNeutralsWarm,
  PalettePeach,
  REFERENCE_PALETTE_NAME,
} from './reference-palette';

export { REFERENCE_PALETTE_NAME };

/**
 * Stillwater Sage — layered surfaces (light mode)
 * L0 background → L1 surface → L2 card → L3 elevated
 * Soft light base (champagne); each layer steps lighter toward the top.
 */
const lightLayers = {
  background: PaletteNeutralsWarm.champagne,
  surface: PaletteNeutralsCool.offWhite,
  inputBackground: PaletteNeutralsCool.offWhite,
  card: PaletteNeutralsCool.offWhite,
  elevated: PaletteNeutralsWarm.warmCream,
} as const;

/**
 * Stillwater Sage — layered surfaces (dark mode)
 * Deep forest base; each layer steps lighter toward the top.
 */
const darkLayers = {
  background: PaletteGreen.forestShadow,
  surface: PaletteGreen.deepMoss,
  inputBackground: PaletteGreen.deepMoss,
  card: PaletteGreen.oliveSage,
  elevated: PaletteAnchors.sageGreen,
} as const;

const primaryColor = PalettePeach.terracotta;
const secondaryColor = PaletteCool.seaGlass;

export const Colors = {
  light: {
    ...lightLayers,
    text: PaletteNeutralsCool.charcoal,
    tint: primaryColor,
    icon: PaletteNeutralsWarm.taupe,
    tabIconDefault: PaletteNeutralsCool.stoneGrey,
    tabIconSelected: primaryColor,
    primary: primaryColor,
    secondary: secondaryColor,
    border: PaletteNeutralsCool.coolGrey,
    muted: PaletteNeutralsCool.stoneGrey,
    danger: PalettePeach.clay,
    onPrimary: PaletteNeutralsWarm.warmCream,
  },
  dark: {
    ...darkLayers,
    text: PaletteNeutralsWarm.champagne,
    tint: PaletteAnchors.mutedApricot,
    icon: PaletteAnchors.sageGreen,
    tabIconDefault: PaletteGreen.eucalyptus,
    tabIconSelected: PaletteAnchors.mutedApricot,
    primary: PaletteAnchors.mutedApricot,
    secondary: PaletteCool.mintPebble,
    border: PaletteNeutralsCool.slate,
    muted: PaletteAnchors.sageGreen,
    danger: PalettePeach.terracotta,
    onPrimary: PaletteNeutralsCool.charcoal,
  },
};

/** @deprecated Prefer `useAppColors()` for the active colour scheme */
export const AppColors = Colors.light;

export const EventColors = {
  nappy: PaletteCool.slateBlue,
  meal: PaletteAnchors.mutedApricot,
  sleep: PaletteCool.lavenderGrey,
} as const;

export const MilestoneColors = {
  language: PaletteAnchors.mutedApricot,
  movement: PaletteCool.seaGlass,
  development: PalettePeach.terracotta,
} as const;

export const MemoryColor = PalettePeach.dustyRose;

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
