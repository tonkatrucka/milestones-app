/**
 * Stillwater Sage — reference colour palette
 *
 * Named for the calm river-stone greens and soft sage tones in the source mood
 * board. Derived from an earthy flat-lay: dried florals, smooth pebbles, ribbed
 * ceramics, and plaster surfaces. Low-contrast, calming tones suited to
 * journaling, timelines, and photo-heavy screens.
 *
 * Five anchor swatches match the labelled hex codes in the source image; the
 * remaining shades extend those families for backgrounds, borders, accents, and text.
 */

/** Display name for this reference palette */
export const REFERENCE_PALETTE_NAME = 'Stillwater Sage' as const;

/** Anchor swatches — exact values from the mood-board labels */
export const PaletteAnchors = {
  lightSand: '#DFCFC5',
  palePeach: '#F1D6C7',
  mutedApricot: '#E7B18F',
  sageGreen: '#B0B6AC',
  mossGreen: '#8A8E77',
} as const;

/** Warm neutrals — sand, cream, stone */
export const PaletteNeutralsWarm = {
  champagne: '#F0EBE3',
  warmCream: '#F8F4EF',
  goldenStraw: '#E8D5B0',
  warmStone: '#C4B5A8',
  taupe: '#A89B8F',
} as const;

/** Peach, blush, and terracotta accents */
export const PalettePeach = {
  blush: '#EDD4C8',
  apricotLight: '#F0C9A8',
  terracotta: '#C4856A',
  dustyRose: '#C9A8A0',
  clay: '#B07D68',
} as const;

/** Greens — sage through forest */
export const PaletteGreen = {
  mintFrost: '#C5D4CA',
  eucalyptus: '#9BA696',
  oliveSage: '#7A7F6A',
  forestShadow: '#4A5248',
  deepMoss: '#5C6252',
} as const;

/** Cool accents — teal, sea glass, lavender-grey */
export const PaletteCool = {
  seaGlass: '#6B9080',
  deepTeal: '#3D5C59',
  mintPebble: '#B8CCC4',
  lavenderGrey: '#C4BFC8',
  slateBlue: '#7A8489',
} as const;

/** Structural neutrals — surfaces, borders, text */
export const PaletteNeutralsCool = {
  offWhite: '#F5F2ED',
  coolGrey: '#C5C2BC',
  stoneGrey: '#9A9590',
  slate: '#6B6862',
  charcoal: '#3A3835',
} as const;

/** Flat map of all 29 reference colours (≥20 as requested) */
export const ReferencePalette = {
  ...PaletteAnchors,
  ...PaletteNeutralsWarm,
  ...PalettePeach,
  ...PaletteGreen,
  ...PaletteCool,
  ...PaletteNeutralsCool,
} as const;

export type ReferencePaletteKey = keyof typeof ReferencePalette;

/** Ordered list for swatch previews, design tools, or Storybook */
export const ReferencePaletteSwatches: ReadonlyArray<{
  key: ReferencePaletteKey;
  hex: string;
  group: string;
}> = [
  // Anchors
  { key: 'lightSand', hex: PaletteAnchors.lightSand, group: 'Anchor' },
  { key: 'palePeach', hex: PaletteAnchors.palePeach, group: 'Anchor' },
  { key: 'mutedApricot', hex: PaletteAnchors.mutedApricot, group: 'Anchor' },
  { key: 'sageGreen', hex: PaletteAnchors.sageGreen, group: 'Anchor' },
  { key: 'mossGreen', hex: PaletteAnchors.mossGreen, group: 'Anchor' },
  // Warm neutrals
  { key: 'champagne', hex: PaletteNeutralsWarm.champagne, group: 'Warm neutral' },
  { key: 'warmCream', hex: PaletteNeutralsWarm.warmCream, group: 'Warm neutral' },
  { key: 'goldenStraw', hex: PaletteNeutralsWarm.goldenStraw, group: 'Warm neutral' },
  { key: 'warmStone', hex: PaletteNeutralsWarm.warmStone, group: 'Warm neutral' },
  { key: 'taupe', hex: PaletteNeutralsWarm.taupe, group: 'Warm neutral' },
  // Peach
  { key: 'blush', hex: PalettePeach.blush, group: 'Peach' },
  { key: 'apricotLight', hex: PalettePeach.apricotLight, group: 'Peach' },
  { key: 'terracotta', hex: PalettePeach.terracotta, group: 'Peach' },
  { key: 'dustyRose', hex: PalettePeach.dustyRose, group: 'Peach' },
  { key: 'clay', hex: PalettePeach.clay, group: 'Peach' },
  // Green
  { key: 'mintFrost', hex: PaletteGreen.mintFrost, group: 'Green' },
  { key: 'eucalyptus', hex: PaletteGreen.eucalyptus, group: 'Green' },
  { key: 'oliveSage', hex: PaletteGreen.oliveSage, group: 'Green' },
  { key: 'forestShadow', hex: PaletteGreen.forestShadow, group: 'Green' },
  { key: 'deepMoss', hex: PaletteGreen.deepMoss, group: 'Green' },
  // Cool
  { key: 'seaGlass', hex: PaletteCool.seaGlass, group: 'Cool' },
  { key: 'deepTeal', hex: PaletteCool.deepTeal, group: 'Cool' },
  { key: 'mintPebble', hex: PaletteCool.mintPebble, group: 'Cool' },
  { key: 'lavenderGrey', hex: PaletteCool.lavenderGrey, group: 'Cool' },
  { key: 'slateBlue', hex: PaletteCool.slateBlue, group: 'Cool' },
  // Cool neutrals
  { key: 'offWhite', hex: PaletteNeutralsCool.offWhite, group: 'Cool neutral' },
  { key: 'coolGrey', hex: PaletteNeutralsCool.coolGrey, group: 'Cool neutral' },
  { key: 'stoneGrey', hex: PaletteNeutralsCool.stoneGrey, group: 'Cool neutral' },
  { key: 'slate', hex: PaletteNeutralsCool.slate, group: 'Cool neutral' },
  { key: 'charcoal', hex: PaletteNeutralsCool.charcoal, group: 'Cool neutral' },
];
