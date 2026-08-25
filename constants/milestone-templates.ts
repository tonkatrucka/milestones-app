import type { MilestoneCategory } from '@/lib/database.types';

export type { MilestoneCategory };

export interface MilestoneTemplate {
  title: string;
  emoji: string;
  /** Optional sub-category key used by First Words and Teeth features */
  subCategory?: string;
}

interface AgeBracket {
  minMonths: number;
  maxMonths: number;
  suggestions: Record<MilestoneCategory, MilestoneTemplate[]>;
}

export const AGE_BRACKETS: AgeBracket[] = [
  {
    minMonths: 0,
    maxMonths: 3,
    suggestions: {
      language: [
        { title: 'First coo', emoji: '🗣️' },
        { title: 'Recognises my voice', emoji: '👂' },
        { title: 'First sounds / gurgling', emoji: '💬' },
        { title: 'Responds to loud sounds', emoji: '🔊' },
      ],
      movement: [
        { title: 'Holds head up', emoji: '💪' },
        { title: 'First tummy time success', emoji: '🐢' },
        { title: 'Tracks object with eyes', emoji: '👀' },
        { title: 'Brings hands to mouth', emoji: '✋' },
        { title: 'Unclenches fists', emoji: '🖐️' },
      ],
      development: [
        { title: 'First smile', emoji: '😊' },
        { title: 'First social smile (in response to us)', emoji: '🥰' },
        { title: 'First bath at home', emoji: '🛁' },
        { title: 'First car ride', emoji: '🚗' },
        { title: 'First night at home', emoji: '🌙' },
        { title: 'First outing', emoji: '🌳' },
        { title: 'Met the grandparents', emoji: '👴' },
      ],
    },
  },
  {
    minMonths: 3,
    maxMonths: 6,
    suggestions: {
      language: [
        { title: 'First babble', emoji: '👶' },
        { title: 'Makes consonant sounds (ba, da)', emoji: '💬' },
        { title: 'Squeals with excitement', emoji: '😄' },
        { title: 'Laughs out loud', emoji: '😂' },
        { title: 'Recognises own name', emoji: '🎯' },
      ],
      movement: [
        { title: 'First roll over (front to back)', emoji: '🔄' },
        { title: 'First roll over (back to front)', emoji: '↩️' },
        { title: 'Sits with support', emoji: '🪑' },
        { title: 'Reaches and grasps toys', emoji: '🧸' },
        { title: 'Brings objects to mouth', emoji: '🍬' },
        { title: 'Pushes up on arms during tummy time', emoji: '💪' },
      ],
      development: [
        { title: 'First giggle', emoji: '😂' },
        { title: 'Recognises familiar faces', emoji: '😍' },
        { title: 'First time in a high chair', emoji: '🪑' },
        { title: 'First time in a bouncer / jumper', emoji: '🎪' },
        { title: 'First solid food attempt', emoji: '🥕' },
        { title: 'First trip away from home', emoji: '✈️' },
      ],
    },
  },
  {
    minMonths: 6,
    maxMonths: 9,
    suggestions: {
      language: [
        { title: 'First "mama"', emoji: '🤱' },
        { title: 'First "dada"', emoji: '👨‍👧' },
        { title: 'Responds to their name', emoji: '👂' },
        { title: 'Copies sounds I make', emoji: '🔁' },
      ],
      movement: [
        { title: 'Sits independently', emoji: '🧘' },
        { title: 'First crawl', emoji: '🐾' },
        { title: 'Pulls to stand', emoji: '🏋️' },
        { title: 'Passes objects between hands', emoji: '🤲' },
        { title: 'Pincer grip developing', emoji: '🤌' },
      ],
      development: [
        { title: 'First tooth', emoji: '🦷', subCategory: 'teeth' },
        { title: 'First solid food', emoji: '🥕' },
        { title: 'First finger food', emoji: '🍌' },
        { title: 'Waves bye-bye', emoji: '👋' },
        { title: 'Plays peek-a-boo', emoji: '🙈' },
        { title: 'First birthday party attended', emoji: '🎂' },
        { title: 'First swim', emoji: '🏊' },
        { title: 'First time at the beach', emoji: '🏖️' },
      ],
    },
  },
  {
    minMonths: 9,
    maxMonths: 12,
    suggestions: {
      language: [
        { title: 'Uses "mama" / "dada" correctly', emoji: '👨‍👩‍👧' },
        { title: 'First word beyond mama/dada', emoji: '💬', subCategory: 'word' },
        { title: 'Shakes head for "no"', emoji: '🙅' },
        { title: 'Points to things they want', emoji: '☝️' },
        { title: 'Tries to imitate words', emoji: '🗣️' },
      ],
      movement: [
        { title: 'Cruises along furniture', emoji: '🚶' },
        { title: 'First independent steps', emoji: '👣' },
        { title: 'Claps hands', emoji: '👏' },
        { title: 'Climbs stairs with help', emoji: '🪜' },
      ],
      development: [
        { title: 'First birthday!', emoji: '🎂' },
        { title: 'First haircut', emoji: '✂️' },
        { title: 'Drinks from a sippy cup', emoji: '🥤' },
        { title: 'Uses a spoon (with help)', emoji: '🥄' },
        { title: 'First Christmas / holiday celebration', emoji: '🎄' },
        { title: 'First holiday abroad', emoji: '✈️' },
        { title: 'Waves hello', emoji: '👋' },
      ],
    },
  },
  {
    minMonths: 12,
    maxMonths: 18,
    suggestions: {
      language: [
        { title: 'First word', emoji: '💬', subCategory: 'word' },
        { title: 'Says 5+ words', emoji: '📢' },
        { title: 'Follows simple instructions', emoji: '👂' },
        { title: 'Points to pictures in books', emoji: '📖' },
        { title: 'Names a body part', emoji: '👃' },
      ],
      movement: [
        { title: 'Walking confidently', emoji: '🚶' },
        { title: 'First run', emoji: '🏃' },
        { title: 'Climbs on furniture', emoji: '🛋️' },
        { title: 'Kicks a ball', emoji: '⚽' },
        { title: 'Throws a ball overhand', emoji: '🏀' },
      ],
      development: [
        { title: 'Stacks 2–3 blocks', emoji: '🧱' },
        { title: 'Uses a spoon independently', emoji: '🥄' },
        { title: 'Scribbles with crayons', emoji: '🖍️' },
        { title: 'Starts nursery / daycare', emoji: '🏫' },
        { title: 'Drinks from an open cup', emoji: '🥛' },
        { title: 'First playdate', emoji: '🤝' },
        { title: 'Helps with simple tasks (tidying)', emoji: '🧹' },
      ],
    },
  },
  {
    minMonths: 18,
    maxMonths: 24,
    suggestions: {
      language: [
        { title: 'Two-word phrases', emoji: '🗣️' },
        { title: 'Says 10+ words', emoji: '📢' },
        { title: 'Says 20+ words', emoji: '💬' },
        { title: 'Names familiar objects', emoji: '🏠' },
        { title: 'Asks simple questions', emoji: '❓' },
        { title: 'Refers to self by name', emoji: '🙋' },
      ],
      movement: [
        { title: 'Runs without falling', emoji: '🏃' },
        { title: 'Jumps with both feet', emoji: '🦘' },
        { title: 'Climbs stairs alone (two feet per step)', emoji: '🪜' },
        { title: 'Kicks a ball on purpose', emoji: '⚽' },
        { title: 'Turns pages of a book', emoji: '📖' },
      ],
      development: [
        { title: 'Plays pretend / imaginative play', emoji: '🎭' },
        { title: 'Interested in other children', emoji: '👫' },
        { title: 'Second birthday!', emoji: '🎂' },
        { title: 'Potty training started', emoji: '🚽' },
        { title: 'Uses fork and spoon well', emoji: '🍴' },
        { title: 'Recognises themselves in the mirror', emoji: '🪞' },
        { title: 'Shows empathy (comforts others)', emoji: '🫂' },
      ],
    },
  },
  {
    minMonths: 24,
    maxMonths: 36,
    suggestions: {
      language: [
        { title: 'Three-word sentences', emoji: '💬' },
        { title: 'Full sentences', emoji: '🗣️' },
        { title: 'Tells a simple story', emoji: '📖' },
        { title: 'Knows their full name', emoji: '🏷️' },
        { title: 'Asks "why?" questions', emoji: '❓' },
        { title: 'Knows colours', emoji: '🌈' },
        { title: 'Counts to 5', emoji: '5️⃣' },
      ],
      movement: [
        { title: 'Climbs stairs alternating feet', emoji: '🪜' },
        { title: 'Pedals a tricycle', emoji: '🛵' },
        { title: 'Catches a large ball', emoji: '⚾' },
        { title: 'Stands on one foot briefly', emoji: '🦩' },
        { title: 'Draws a circle', emoji: '⭕' },
      ],
      development: [
        { title: 'Third birthday!', emoji: '🎂' },
        { title: 'Potty trained (daytime)', emoji: '🚽' },
        { title: 'Dresses with help', emoji: '👗' },
        { title: 'Plays with other children (not just alongside)', emoji: '👫' },
        { title: 'Understands sharing', emoji: '🤝' },
        { title: 'First day at preschool', emoji: '🏫' },
        { title: 'Uses scissors', emoji: '✂️' },
      ],
    },
  },
  {
    minMonths: 36,
    maxMonths: 999,
    suggestions: {
      language: [
        { title: 'Reads first words', emoji: '📚' },
        { title: 'Writes their name', emoji: '✏️' },
        { title: 'Tells a full story with beginning, middle, end', emoji: '📖' },
        { title: 'Knows the alphabet', emoji: '🔤' },
        { title: 'Counts to 20', emoji: '🔢' },
      ],
      movement: [
        { title: 'Rides a bike without stabilisers', emoji: '🚲' },
        { title: 'Jumps rope', emoji: '🪢' },
        { title: 'Swims independently', emoji: '🏊' },
        { title: 'Ties shoelaces', emoji: '👟' },
        { title: 'Cartwheels / gymnastics', emoji: '🤸' },
      ],
      development: [
        { title: 'Fourth birthday!', emoji: '🎂' },
        { title: 'Fifth birthday!', emoji: '🎂' },
        { title: 'First day of school', emoji: '🏫' },
        { title: 'Reads independently', emoji: '📚' },
        { title: 'Dresses completely independently', emoji: '👗' },
        { title: 'First sleepover away from home', emoji: '🌙' },
        { title: 'First sports team / activity', emoji: '⚽' },
        { title: 'Loses first tooth', emoji: '🦷', subCategory: 'teeth' },
      ],
    },
  },
];

// ─── Firsts — a dedicated "bucket list" of universal firsts ─────────────────

export interface FirstTemplate {
  title: string;
  emoji: string;
  typicalAgeMonths?: number;
}

export const FIRSTS_TEMPLATES: FirstTemplate[] = [
  { title: 'First breath', emoji: '💨', typicalAgeMonths: 0 },
  { title: 'First night at home', emoji: '🌙', typicalAgeMonths: 0 },
  { title: 'First bath', emoji: '🛁', typicalAgeMonths: 0 },
  { title: 'First smile', emoji: '😊', typicalAgeMonths: 1 },
  { title: 'First giggle', emoji: '😂', typicalAgeMonths: 3 },
  { title: 'First laugh out loud', emoji: '🤣', typicalAgeMonths: 3 },
  { title: 'First roll over', emoji: '🔄', typicalAgeMonths: 4 },
  { title: 'First tooth', emoji: '🦷', typicalAgeMonths: 6 },
  { title: 'First solid food', emoji: '🥕', typicalAgeMonths: 6 },
  { title: 'First sit up independently', emoji: '🧘', typicalAgeMonths: 6 },
  { title: 'First crawl', emoji: '🐾', typicalAgeMonths: 8 },
  { title: 'First pull to stand', emoji: '🏋️', typicalAgeMonths: 9 },
  { title: 'First word', emoji: '💬', typicalAgeMonths: 10 },
  { title: 'First steps', emoji: '👣', typicalAgeMonths: 12 },
  { title: 'First haircut', emoji: '✂️', typicalAgeMonths: 12 },
  { title: 'First birthday', emoji: '🎂', typicalAgeMonths: 12 },
  { title: 'First Christmas', emoji: '🎄' },
  { title: 'First Easter', emoji: '🐣' },
  { title: 'First car ride', emoji: '🚗', typicalAgeMonths: 0 },
  { title: 'First swim', emoji: '🏊', typicalAgeMonths: 6 },
  { title: 'First playdate', emoji: '🤝', typicalAgeMonths: 12 },
  { title: 'First book read aloud', emoji: '📖', typicalAgeMonths: 1 },
  { title: 'First trip on a plane', emoji: '✈️' },
  { title: 'First day at nursery', emoji: '🏫', typicalAgeMonths: 9 },
  { title: 'First "I love you"', emoji: '❤️', typicalAgeMonths: 18 },
];

// ─── Teeth tracker ───────────────────────────────────────────────────────────

export interface ToothTemplate {
  id: string;
  name: string;
  typicalAgeMonths: number;
  position: 'upper' | 'lower';
  side: 'centre' | 'lateral' | 'canine' | 'first_molar' | 'second_molar';
}

export const TEETH_SEQUENCE: ToothTemplate[] = [
  { id: 'lower_central_1', name: 'Lower central incisor (1st)', typicalAgeMonths: 6, position: 'lower', side: 'centre' },
  { id: 'lower_central_2', name: 'Lower central incisor (2nd)', typicalAgeMonths: 7, position: 'lower', side: 'centre' },
  { id: 'upper_central_1', name: 'Upper central incisor (1st)', typicalAgeMonths: 8, position: 'upper', side: 'centre' },
  { id: 'upper_central_2', name: 'Upper central incisor (2nd)', typicalAgeMonths: 9, position: 'upper', side: 'centre' },
  { id: 'upper_lateral_1', name: 'Upper lateral incisor (1st)', typicalAgeMonths: 10, position: 'upper', side: 'lateral' },
  { id: 'upper_lateral_2', name: 'Upper lateral incisor (2nd)', typicalAgeMonths: 11, position: 'upper', side: 'lateral' },
  { id: 'lower_lateral_1', name: 'Lower lateral incisor (1st)', typicalAgeMonths: 12, position: 'lower', side: 'lateral' },
  { id: 'lower_lateral_2', name: 'Lower lateral incisor (2nd)', typicalAgeMonths: 13, position: 'lower', side: 'lateral' },
  { id: 'upper_first_molar_1', name: 'Upper first molar (1st)', typicalAgeMonths: 14, position: 'upper', side: 'first_molar' },
  { id: 'upper_first_molar_2', name: 'Upper first molar (2nd)', typicalAgeMonths: 15, position: 'upper', side: 'first_molar' },
  { id: 'lower_first_molar_1', name: 'Lower first molar (1st)', typicalAgeMonths: 16, position: 'lower', side: 'first_molar' },
  { id: 'lower_first_molar_2', name: 'Lower first molar (2nd)', typicalAgeMonths: 17, position: 'lower', side: 'first_molar' },
  { id: 'upper_canine_1', name: 'Upper canine (1st)', typicalAgeMonths: 18, position: 'upper', side: 'canine' },
  { id: 'upper_canine_2', name: 'Upper canine (2nd)', typicalAgeMonths: 19, position: 'upper', side: 'canine' },
  { id: 'lower_canine_1', name: 'Lower canine (1st)', typicalAgeMonths: 20, position: 'lower', side: 'canine' },
  { id: 'lower_canine_2', name: 'Lower canine (2nd)', typicalAgeMonths: 21, position: 'lower', side: 'canine' },
  { id: 'lower_second_molar_1', name: 'Lower second molar (1st)', typicalAgeMonths: 24, position: 'lower', side: 'second_molar' },
  { id: 'lower_second_molar_2', name: 'Lower second molar (2nd)', typicalAgeMonths: 25, position: 'lower', side: 'second_molar' },
  { id: 'upper_second_molar_1', name: 'Upper second molar (1st)', typicalAgeMonths: 26, position: 'upper', side: 'second_molar' },
  { id: 'upper_second_molar_2', name: 'Upper second molar (2nd)', typicalAgeMonths: 27, position: 'upper', side: 'second_molar' },
];

// ─── CDC-aligned developmental checklist ─────────────────────────────────────

export type ChecklistArea = 'social' | 'language' | 'cognitive' | 'movement';

export interface DevCheckpoint {
  id: string;
  area: ChecklistArea;
  description: string;
  /** At what age most babies (75%+) have achieved this, per CDC 2022 guidelines */
  byAgeMonths: number;
  actEarlyIfMissedBy?: number;
}

export const CDC_CHECKPOINTS: DevCheckpoint[] = [
  // 2 months
  { id: 'c2_social_1', area: 'social', description: 'Calms down when spoken to or picked up', byAgeMonths: 2, actEarlyIfMissedBy: 4 },
  { id: 'c2_social_2', area: 'social', description: 'Looks at your face', byAgeMonths: 2, actEarlyIfMissedBy: 4 },
  { id: 'c2_lang_1', area: 'language', description: 'Makes sounds other than crying', byAgeMonths: 2, actEarlyIfMissedBy: 4 },
  { id: 'c2_lang_2', area: 'language', description: 'Reacts to loud sounds', byAgeMonths: 2, actEarlyIfMissedBy: 4 },
  { id: 'c2_cog_1', area: 'cognitive', description: 'Watches you as you move', byAgeMonths: 2, actEarlyIfMissedBy: 4 },
  { id: 'c2_move_1', area: 'movement', description: 'Holds head up when on tummy', byAgeMonths: 2, actEarlyIfMissedBy: 4 },
  { id: 'c2_move_2', area: 'movement', description: 'Moves both arms and legs', byAgeMonths: 2, actEarlyIfMissedBy: 4 },
  // 4 months
  { id: 'c4_social_1', area: 'social', description: 'Smiles on their own to get your attention', byAgeMonths: 4, actEarlyIfMissedBy: 6 },
  { id: 'c4_social_2', area: 'social', description: 'Chuckles (not yet a full laugh)', byAgeMonths: 4, actEarlyIfMissedBy: 6 },
  { id: 'c4_lang_1', area: 'language', description: 'Makes sounds like "oooh" and "aahh"', byAgeMonths: 4, actEarlyIfMissedBy: 6 },
  { id: 'c4_lang_2', area: 'language', description: 'Makes sounds back when talked to', byAgeMonths: 4, actEarlyIfMissedBy: 6 },
  { id: 'c4_cog_1', area: 'cognitive', description: 'Looks at hands with interest', byAgeMonths: 4, actEarlyIfMissedBy: 6 },
  { id: 'c4_move_1', area: 'movement', description: 'Holds head steady without support', byAgeMonths: 4, actEarlyIfMissedBy: 6 },
  { id: 'c4_move_2', area: 'movement', description: 'Holds a toy when put in hand', byAgeMonths: 4, actEarlyIfMissedBy: 6 },
  // 6 months
  { id: 'c6_social_1', area: 'social', description: 'Knows familiar people', byAgeMonths: 6, actEarlyIfMissedBy: 9 },
  { id: 'c6_social_2', area: 'social', description: 'Likes to look at themselves in a mirror', byAgeMonths: 6, actEarlyIfMissedBy: 9 },
  { id: 'c6_lang_1', area: 'language', description: 'Takes turns making sounds with you', byAgeMonths: 6, actEarlyIfMissedBy: 9 },
  { id: 'c6_lang_2', area: 'language', description: 'Blows "raspberries"', byAgeMonths: 6, actEarlyIfMissedBy: 9 },
  { id: 'c6_cog_1', area: 'cognitive', description: 'Reaches for a toy they want', byAgeMonths: 6, actEarlyIfMissedBy: 9 },
  { id: 'c6_move_1', area: 'movement', description: 'Rolls from tummy to back', byAgeMonths: 6, actEarlyIfMissedBy: 9 },
  { id: 'c6_move_2', area: 'movement', description: 'Pushes up on straight arms on tummy', byAgeMonths: 6, actEarlyIfMissedBy: 9 },
  // 9 months
  { id: 'c9_social_1', area: 'social', description: 'Is shy, clingy, or fearful around strangers', byAgeMonths: 9, actEarlyIfMissedBy: 12 },
  { id: 'c9_social_2', area: 'social', description: 'Shows several facial expressions', byAgeMonths: 9, actEarlyIfMissedBy: 12 },
  { id: 'c9_lang_1', area: 'language', description: 'Makes a lot of different sounds like "mamamama" and "babababa"', byAgeMonths: 9, actEarlyIfMissedBy: 12 },
  { id: 'c9_lang_2', area: 'language', description: 'Lifts arms up to be picked up', byAgeMonths: 9, actEarlyIfMissedBy: 12 },
  { id: 'c9_cog_1', area: 'cognitive', description: 'Looks for objects when dropped out of sight', byAgeMonths: 9, actEarlyIfMissedBy: 12 },
  { id: 'c9_move_1', area: 'movement', description: 'Gets to a sitting position by themselves', byAgeMonths: 9, actEarlyIfMissedBy: 12 },
  { id: 'c9_move_2', area: 'movement', description: 'Moves things from one hand to the other', byAgeMonths: 9, actEarlyIfMissedBy: 12 },
  // 12 months
  { id: 'c12_social_1', area: 'social', description: 'Plays games with you like pat-a-cake', byAgeMonths: 12, actEarlyIfMissedBy: 15 },
  { id: 'c12_lang_1', area: 'language', description: 'Waves "bye-bye"', byAgeMonths: 12, actEarlyIfMissedBy: 15 },
  { id: 'c12_lang_2', area: 'language', description: 'Calls a parent "mama" or "dada" or another special name', byAgeMonths: 12, actEarlyIfMissedBy: 15 },
  { id: 'c12_lang_3', area: 'language', description: 'Understands "no" (pauses briefly)', byAgeMonths: 12, actEarlyIfMissedBy: 15 },
  { id: 'c12_cog_1', area: 'cognitive', description: 'Puts something in a container', byAgeMonths: 12, actEarlyIfMissedBy: 15 },
  { id: 'c12_move_1', area: 'movement', description: 'Pulls up to stand', byAgeMonths: 12, actEarlyIfMissedBy: 15 },
  { id: 'c12_move_2', area: 'movement', description: 'Walks holding on to furniture', byAgeMonths: 12, actEarlyIfMissedBy: 15 },
  // 15 months
  { id: 'c15_social_1', area: 'social', description: 'Copies other children while playing', byAgeMonths: 15, actEarlyIfMissedBy: 18 },
  { id: 'c15_social_2', area: 'social', description: 'Shows you an object they like', byAgeMonths: 15, actEarlyIfMissedBy: 18 },
  { id: 'c15_lang_1', area: 'language', description: 'Says 3 words besides "mama" or "dada"', byAgeMonths: 15, actEarlyIfMissedBy: 18 },
  { id: 'c15_cog_1', area: 'cognitive', description: 'Tries to use things the right way', byAgeMonths: 15, actEarlyIfMissedBy: 18 },
  { id: 'c15_move_1', area: 'movement', description: 'Takes a few steps on their own', byAgeMonths: 15, actEarlyIfMissedBy: 18 },
  // 18 months
  { id: 'c18_social_1', area: 'social', description: 'Moves away from you, but checks in', byAgeMonths: 18, actEarlyIfMissedBy: 24 },
  { id: 'c18_social_2', area: 'social', description: 'Points to show you something interesting', byAgeMonths: 18, actEarlyIfMissedBy: 24 },
  { id: 'c18_lang_1', area: 'language', description: 'Tries to say 3+ words besides "mama" or "dada"', byAgeMonths: 18, actEarlyIfMissedBy: 24 },
  { id: 'c18_cog_1', area: 'cognitive', description: 'Copies simple actions', byAgeMonths: 18, actEarlyIfMissedBy: 24 },
  { id: 'c18_move_1', area: 'movement', description: 'Walks without holding on', byAgeMonths: 18, actEarlyIfMissedBy: 24 },
  // 24 months
  { id: 'c24_social_1', area: 'social', description: 'Notices when others are hurt or upset', byAgeMonths: 24, actEarlyIfMissedBy: 30 },
  { id: 'c24_lang_1', area: 'language', description: 'Says 2+ words together ("more milk")', byAgeMonths: 24, actEarlyIfMissedBy: 30 },
  { id: 'c24_lang_2', area: 'language', description: 'Points to things in a book when asked', byAgeMonths: 24, actEarlyIfMissedBy: 30 },
  { id: 'c24_cog_1', area: 'cognitive', description: 'Holds something in one hand and uses the other', byAgeMonths: 24, actEarlyIfMissedBy: 30 },
  { id: 'c24_move_1', area: 'movement', description: 'Runs', byAgeMonths: 24, actEarlyIfMissedBy: 30 },
  { id: 'c24_move_2', area: 'movement', description: 'Kicks a ball', byAgeMonths: 24, actEarlyIfMissedBy: 30 },
];

export function getSuggestionsForAge(ageMonths: number, category: MilestoneCategory): MilestoneTemplate[] {
  const bracket = AGE_BRACKETS.find(
    (b) => ageMonths >= b.minMonths && ageMonths < b.maxMonths,
  );
  return bracket?.suggestions[category] ?? [];
}

export function getAllSuggestionsForAge(ageMonths: number): {
  category: MilestoneCategory;
  templates: MilestoneTemplate[];
}[] {
  const categories: MilestoneCategory[] = ['language', 'movement', 'development'];
  return categories.map((category) => ({
    category,
    templates: getSuggestionsForAge(ageMonths, category),
  }));
}

export function getCheckpointsForAge(ageMonths: number): DevCheckpoint[] {
  const checkAges = [2, 4, 6, 9, 12, 15, 18, 24];
  const relevant = checkAges.filter((a) => ageMonths >= a && ageMonths < a + 4);
  return CDC_CHECKPOINTS.filter((c) => relevant.includes(c.byAgeMonths));
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

export const CHECKLIST_AREA_LABELS: Record<ChecklistArea, string> = {
  social: 'Social & emotional',
  language: 'Communication',
  cognitive: 'Learning & thinking',
  movement: 'Movement & play',
};
