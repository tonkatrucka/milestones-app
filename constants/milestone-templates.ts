import type { MilestoneCategory } from '@/lib/database.types';

export type { MilestoneCategory };

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
      language: [
        { title: 'First coo', emoji: '🗣️' },
        { title: 'First babble', emoji: '👶' },
        { title: 'Recognises my voice', emoji: '👂' },
      ],
      movement: [
        { title: 'First roll over', emoji: '🔄' },
        { title: 'Holds head up', emoji: '💪' },
        { title: 'Sits with support', emoji: '🪑' },
      ],
      development: [
        { title: 'First smile', emoji: '😊' },
        { title: 'Tracks objects with eyes', emoji: '👀' },
        { title: 'First laugh', emoji: '😂' },
      ],
    },
  },
  {
    minMonths: 6,
    maxMonths: 12,
    suggestions: {
      language: [
        { title: 'First "mama"', emoji: '🤱' },
        { title: 'First "dada"', emoji: '👨‍👧' },
        { title: 'Responds to name', emoji: '👂' },
      ],
      movement: [
        { title: 'Sits independently', emoji: '🧘' },
        { title: 'First crawl', emoji: '🐾' },
        { title: 'Pulls to stand', emoji: '🏋️' },
      ],
      development: [
        { title: 'First tooth', emoji: '🦷' },
        { title: 'First solid food', emoji: '🥕' },
        { title: 'Waves bye-bye', emoji: '👋' },
      ],
    },
  },
  {
    minMonths: 12,
    maxMonths: 24,
    suggestions: {
      language: [
        { title: 'First word', emoji: '💬' },
        { title: 'Two-word phrases', emoji: '🗣️' },
        { title: 'Says 10+ words', emoji: '📢' },
      ],
      movement: [
        { title: 'First independent steps', emoji: '👣' },
        { title: 'Walking confidently', emoji: '🚶' },
        { title: 'First run', emoji: '🏃' },
      ],
      development: [
        { title: 'Stacks blocks', emoji: '🧱' },
        { title: 'Uses a spoon', emoji: '🥄' },
        { title: 'Scribbles with crayon', emoji: '🖍️' },
      ],
    },
  },
  {
    minMonths: 24,
    maxMonths: 999,
    suggestions: {
      language: [
        { title: 'Full sentences', emoji: '💬' },
        { title: 'Tells a story', emoji: '📖' },
        { title: 'Knows colours', emoji: '🌈' },
      ],
      movement: [
        { title: 'Climbs stairs alone', emoji: '🪜' },
        { title: 'Kicks a ball', emoji: '⚽' },
        { title: 'Jumps with both feet', emoji: '🦘' },
      ],
      development: [
        { title: 'Draws a circle', emoji: '⭕' },
        { title: 'Uses scissors', emoji: '✂️' },
        { title: 'Dresses independently', emoji: '👗' },
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
  language: 'Language',
  movement: 'Movement',
  development: 'Development',
};

export const CATEGORY_EMOJIS: Record<MilestoneCategory, string> = {
  language: '💬',
  movement: '🏃',
  development: '🌱',
};
