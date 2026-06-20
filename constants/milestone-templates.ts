export type MilestoneCategory = 'word' | 'steps' | 'physical' | 'custom';

export interface MilestoneTemplate {
  title: string;
  emoji: string;
}

interface AgeBracket {
  minMonths: number;
  maxMonths: number;
  suggestions: Record<MilestoneCategory, MilestoneTemplate[]>;
}

export const AGE_BRACKETS: AgeBracket[] = [
  {
    minMonths: 0,
    maxMonths: 6,
    suggestions: {
      word: [
        { title: 'First coo', emoji: '🗣️' },
        { title: 'First babble', emoji: '👶' },
        { title: 'Recognises my voice', emoji: '👂' },
      ],
      steps: [
        { title: 'First roll over', emoji: '🔄' },
        { title: 'Holds head up', emoji: '💪' },
        { title: 'Sits with support', emoji: '🪑' },
      ],
      physical: [
        { title: 'First smile', emoji: '😊' },
        { title: 'Tracks objects with eyes', emoji: '👀' },
        { title: 'First laugh', emoji: '😂' },
      ],
      custom: [
        { title: 'First bath', emoji: '🛁' },
        { title: 'First outing', emoji: '🌳' },
        { title: 'Met grandparents', emoji: '👴' },
      ],
    },
  },
  {
    minMonths: 6,
    maxMonths: 12,
    suggestions: {
      word: [
        { title: 'First "mama"', emoji: '🤱' },
        { title: 'First "dada"', emoji: '👨‍👧' },
        { title: 'Responds to name', emoji: '👂' },
      ],
      steps: [
        { title: 'Sits independently', emoji: '🧘' },
        { title: 'First crawl', emoji: '🐾' },
        { title: 'Pulls to stand', emoji: '🏋️' },
      ],
      physical: [
        { title: 'First tooth', emoji: '🦷' },
        { title: 'First solid food', emoji: '🥕' },
        { title: 'Waves bye-bye', emoji: '👋' },
      ],
      custom: [
        { title: 'First swim', emoji: '🏊' },
        { title: 'First birthday', emoji: '🎂' },
        { title: 'First holiday', emoji: '✈️' },
      ],
    },
  },
  {
    minMonths: 12,
    maxMonths: 24,
    suggestions: {
      word: [
        { title: 'First word', emoji: '💬' },
        { title: 'Two-word phrases', emoji: '🗣️' },
        { title: 'Says 10+ words', emoji: '📢' },
      ],
      steps: [
        { title: 'First independent steps', emoji: '👣' },
        { title: 'Walking confidently', emoji: '🚶' },
        { title: 'First run', emoji: '🏃' },
      ],
      physical: [
        { title: 'Stacks blocks', emoji: '🧱' },
        { title: 'Uses a spoon', emoji: '🥄' },
        { title: 'Scribbles with crayon', emoji: '🖍️' },
      ],
      custom: [
        { title: 'First haircut', emoji: '✂️' },
        { title: 'Favourite toy', emoji: '🧸' },
        { title: 'First friend', emoji: '👫' },
      ],
    },
  },
  {
    minMonths: 24,
    maxMonths: 999,
    suggestions: {
      word: [
        { title: 'Full sentences', emoji: '💬' },
        { title: 'Tells a story', emoji: '📖' },
        { title: 'Knows colours', emoji: '🌈' },
      ],
      steps: [
        { title: 'Climbs stairs alone', emoji: '🪜' },
        { title: 'Kicks a ball', emoji: '⚽' },
        { title: 'Jumps with both feet', emoji: '🦘' },
      ],
      physical: [
        { title: 'Draws a circle', emoji: '⭕' },
        { title: 'Uses scissors', emoji: '✂️' },
        { title: 'Dresses independently', emoji: '👗' },
      ],
      custom: [
        { title: 'First day at nursery', emoji: '🏫' },
        { title: 'Rides a balance bike', emoji: '🚲' },
        { title: 'First sleepover', emoji: '🌙' },
      ],
    },
  },
];

export function getSuggestionsForAge(ageMonths: number, category: MilestoneCategory): MilestoneTemplate[] {
  const bracket = AGE_BRACKETS.find(
    (b) => ageMonths >= b.minMonths && ageMonths < b.maxMonths,
  );
  return bracket?.suggestions[category] ?? [];
}

export const CATEGORY_LABELS: Record<MilestoneCategory, string> = {
  word: 'Language',
  steps: 'Movement',
  physical: 'Development',
  custom: 'Moments',
};

export const CATEGORY_EMOJIS: Record<MilestoneCategory, string> = {
  word: '💬',
  steps: '🏃',
  physical: '🌱',
  custom: '⭐',
};
