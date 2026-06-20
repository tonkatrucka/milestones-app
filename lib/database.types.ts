export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type EventType = 'nappy' | 'meal' | 'sleep';
export type MilestoneCategory = 'word' | 'steps' | 'physical' | 'custom';
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
      invites: {
        Row: Invite;
        Insert: Omit<Invite, 'id' | 'token' | 'created_at'>;
        Update: Partial<Omit<Invite, 'id' | 'created_at'>>;
      };
    };
    Functions: {
      accept_invite: {
        Args: { invite_token: string };
        Returns: void;
      };
    };
  };
}
