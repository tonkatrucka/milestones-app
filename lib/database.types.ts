export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type EventType = 'nappy' | 'meal' | 'sleep';
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

export interface MealMetadata {
  mealType: 'breast' | 'bottle' | 'solid' | 'snack';
  amountMl?: number;
  food?: string;
}

export interface SleepMetadata {
  sleepEnd?: string;
}

export type EventMetadata = NappyMetadata | MealMetadata | SleepMetadata | Record<string, never>;

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
