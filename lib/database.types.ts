export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type CoreEventType = 'nappy' | 'meal' | 'sleep';
export type ExtendedEventType = 'pump' | 'temperature' | 'medication';
export type EventType = CoreEventType | ExtendedEventType;
export type MilestoneCategory = 'language' | 'movement' | 'development';
export type MemberRole = 'owner' | 'caregiver' | 'viewer';

export interface Child {
  id: string;
  name: string;
  date_of_birth: string;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
}

export interface ChildMember {
  child_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
}

export interface NappyMetadata {
  nappyType: 'wet' | 'dirty' | 'both' | 'dry';
}

export type BreastSide = 'left' | 'right' | 'both';

export interface MealMetadata {
  mealType: 'breast' | 'bottle' | 'solid' | 'snack';
  amountMl?: number;
  durationMins?: number;
  breastSide?: BreastSide;
  food?: string;
}

export interface SleepMetadata {
  sleepEnd?: string;
}

export interface PumpMetadata {
  amountMl?: number;
  durationMins?: number;
  breastSide?: BreastSide;
}

export interface TemperatureMetadata {
  tempC: number;
  method?: 'axillary' | 'rectal' | 'ear' | 'forehead';
}

export interface MedicationMetadata {
  name: string;
  doseAmountMl?: number;
  doseIntervalHours?: number;
  notes?: string;
}

export type EventMetadata =
  | NappyMetadata
  | MealMetadata
  | SleepMetadata
  | PumpMetadata
  | TemperatureMetadata
  | MedicationMetadata
  | Record<string, never>;

export interface DailyEvent {
  id: string;
  child_id: string;
  type: EventType;
  occurred_at: string;
  notes: string | null;
  metadata: EventMetadata;
  created_by: string | null;
  created_at: string;
}

export interface Milestone {
  id: string;
  child_id: string;
  category: MilestoneCategory;
  title: string;
  description: string | null;
  achieved_at: string;
  media_urls: string[];
  audio_url: string | null;
  is_private: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Memory {
  id: string;
  child_id: string;
  title: string;
  description: string | null;
  occurred_at: string;
  media_urls: string[];
  tags: string[];
  audio_url: string | null;
  is_private: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  child_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  media_urls: string[];
  created_at: string;
}

export type ResearchAgeBracket =
  | 'newborn'
  | 'infant_early'
  | 'infant'
  | 'infant_late'
  | 'toddler_early'
  | 'toddler'
  | 'toddler_late';

export type ResearchCategory =
  | 'sleep'
  | 'feeding'
  | 'development'
  | 'milestones'
  | 'regression'
  | 'language';

export interface ResearchBulletRow {
  id: string;
  age_bracket: ResearchAgeBracket;
  category: ResearchCategory;
  subtopic: string;
  text: string;
  source_url: string;
  source_name: string;
  source_domain: string;
  source_tier: 'tier_1' | 'tier_2' | 'tier_3a' | 'tier_3b';
  source_region: 'UK' | 'US' | 'AU' | 'CA' | 'GLOBAL';
  content_hash: string;
  created_at: string;
  reviewed_at: string;
  superseded_by_id: string | null;
  active: boolean;
}

export interface ChildInsights {
  child_id: string;
  insight_date: string;
  short_insights: string[] | null;
  long_insights: string[] | null;
  categories: string[];
  selected_research_by_region: Record<string, string[]>;
  generated_at: string;
  weekly_narrative: string | null;
  weekly_narrative_week: string | null;
}

export interface ChildResearchShown {
  child_id: string;
  bullet_id: string;
  first_shown_on: string;
}

export interface Invite {
  id: string;
  child_id: string;
  email: string;
  role: MemberRole;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_by: string;
  created_at: string;
}

export interface MilestoneReaction {
  id: string;
  milestone_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface MemoryReaction {
  id: string;
  memory_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface MilestoneComment {
  id: string;
  milestone_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export interface MemoryComment {
  id: string;
  memory_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export interface MonthlyRecap {
  child_id: string;
  month_key: string;
  narrative: string;
  generated_at: string;
}

export interface DigestFollower {
  id: string;
  child_id: string;
  email: string;
  display_name: string | null;
  added_by: string;
  is_active: boolean;
  frequency: 'weekly' | 'monthly';
  content_filter: 'all' | 'milestones_only' | 'no_photos';
  created_at: string;
}

export interface ShareLink {
  id: string;
  token: string;
  child_id: string;
  content_id: string;
  content_type: 'milestone' | 'memory';
  created_by: string;
  expires_at: string;
  view_count: number;
  max_views: number;
  revoked_at: string | null;
  created_at: string;
}

export interface FirstWord {
  id: string;
  child_id: string;
  word: string;
  phonetic: string | null;
  said_at: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface TimeCapsule {
  id: string;
  child_id: string;
  title: string;
  body: string;
  media_urls: string[];
  audio_url: string | null;
  unlock_at: string;
  unlocked_at: string | null;
  created_by: string;
  created_at: string;
}

export type DevChecklistStatus = 'yes' | 'not_yet' | 'not_sure';

export interface DevChecklistEntry {
  child_id: string;
  checkpoint_id: string;
  status: DevChecklistStatus;
  noted_at: string;
  notes: string | null;
}

export interface GrowthEntry {
  id: string;
  child_id: string;
  measured_at: string;
  weight_kg: number | null;
  height_cm: number | null;
  head_cm: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ParentCheckin {
  id: string;
  user_id: string;
  child_id: string;
  checked_in_at: string;
  mood_score: number;
  energy_score: number;
  sleep_score: number;
  note: string | null;
  created_at: string;
}

export interface SleepPrediction {
  child_id: string;
  generated_date: string;
  wake_window_mins: number | null;
  next_nap_start: string | null;
  next_nap_end: string | null;
  confidence: number | null;
  avg_nap_mins: number | null;
  data_days: number | null;
  updated_at: string;
}

export type FoodReaction = 'none' | 'mild' | 'moderate' | 'severe';

export interface SolidFood {
  id: string;
  child_id: string;
  food_name: string;
  introduced_at: string;
  is_top_allergen: boolean;
  reaction: FoodReaction | null;
  reaction_notes: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface VaccinationRecord {
  id: string;
  child_id: string;
  vaccine_code: string;
  vaccine_name: string;
  administered_at: string;
  dose_number: number;
  clinic: string | null;
  batch_number: string | null;
  reaction_notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  notify_activities: boolean;
  notify_memories: boolean;
  notify_milestones: boolean;
  updated_at: string;
}

export interface PushToken {
  id: string;
  user_id: string;
  expo_push_token: string;
  platform: string | null;
  device_id: string | null;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      children: {
        Row: Child;
        Insert: Omit<Child, 'id' | 'created_at'>;
        Update: Partial<Omit<Child, 'id' | 'created_at'>>;
      };
      child_members: {
        Row: ChildMember;
        Insert: ChildMember;
        Update: Partial<ChildMember>;
      };
      daily_events: {
        Row: DailyEvent;
        Insert: Omit<DailyEvent, 'id' | 'created_at'>;
        Update: Partial<Omit<DailyEvent, 'id' | 'created_at'>>;
      };
      milestones: {
        Row: Milestone;
        Insert: Omit<Milestone, 'id' | 'created_at'>;
        Update: Partial<Omit<Milestone, 'id' | 'created_at'>>;
      };
      memories: {
        Row: Memory;
        Insert: Omit<Memory, 'id' | 'created_at'>;
        Update: Partial<Omit<Memory, 'id' | 'created_at'>>;
      };
      chat_messages: {
        Row: ChatMessage;
        Insert: Omit<ChatMessage, 'id' | 'created_at'>;
        Update: Partial<Omit<ChatMessage, 'id' | 'created_at'>>;
      };
      invites: {
        Row: Invite;
        Insert: Omit<Invite, 'id' | 'token' | 'created_at'>;
        Update: Partial<Omit<Invite, 'id' | 'created_at'>>;
      };
      notification_preferences: {
        Row: NotificationPreferences;
        Insert: Omit<NotificationPreferences, 'updated_at'> & { updated_at?: string };
        Update: Partial<Omit<NotificationPreferences, 'user_id'>>;
      };
      push_tokens: {
        Row: PushToken;
        Insert: Omit<PushToken, 'id' | 'updated_at'> & { id?: string; updated_at?: string };
        Update: Partial<Omit<PushToken, 'id'>>;
      };
      research_bullets: {
        Row: ResearchBulletRow;
        Insert: Omit<ResearchBulletRow, 'id' | 'created_at' | 'reviewed_at' | 'superseded_by_id' | 'active'> & {
          reviewed_at?: string;
          superseded_by_id?: string | null;
          active?: boolean;
        };
        Update: Partial<Omit<ResearchBulletRow, 'id' | 'created_at'>>;
      };
      child_insights: {
        Row: ChildInsights;
        Insert: Omit<ChildInsights, 'generated_at'> & { generated_at?: string };
        Update: Partial<Omit<ChildInsights, 'child_id' | 'insight_date'>>;
      };
      child_research_shown: {
        Row: ChildResearchShown;
        Insert: ChildResearchShown;
        Update: Partial<ChildResearchShown>;
      };
      growth_entries: {
        Row: GrowthEntry;
        Insert: Omit<GrowthEntry, 'id' | 'created_at'>;
        Update: Partial<Omit<GrowthEntry, 'id' | 'child_id' | 'created_at'>>;
      };
      parent_checkins: {
        Row: ParentCheckin;
        Insert: Omit<ParentCheckin, 'id' | 'created_at'>;
        Update: Partial<Omit<ParentCheckin, 'id' | 'user_id' | 'child_id' | 'created_at'>>;
      };
      child_sleep_predictions: {
        Row: SleepPrediction;
        Insert: Omit<SleepPrediction, 'updated_at'>;
        Update: Partial<Omit<SleepPrediction, 'child_id'>>;
      };
      solid_foods: {
        Row: SolidFood;
        Insert: Omit<SolidFood, 'id' | 'created_at'>;
        Update: Partial<Omit<SolidFood, 'id' | 'child_id' | 'created_at'>>;
      };
      vaccinations: {
        Row: VaccinationRecord;
        Insert: Omit<VaccinationRecord, 'id' | 'created_at'>;
        Update: Partial<Omit<VaccinationRecord, 'id' | 'child_id' | 'created_at'>>;
      };
    };
    Functions: {
      accept_invite: {
        Args: { invite_token: string };
        Returns: void;
      };
      list_child_members: {
        Args: { p_child_id: string };
        Returns: {
          user_id: string;
          role: MemberRole;
          email: string;
          created_at: string;
        }[];
      };
      update_member_role: {
        Args: { p_child_id: string; p_user_id: string; p_role: 'caregiver' | 'viewer' };
        Returns: void;
      };
      delete_my_account: {
        Args: Record<string, never>;
        Returns: void;
      };
      transfer_child_ownership: {
        Args: { p_child_id: string; p_new_owner_id: string };
        Returns: void;
      };
    };
  };
}
