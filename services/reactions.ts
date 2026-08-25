import { supabase } from '@/lib/supabase';
import type { MilestoneReaction, MemoryReaction } from '@/lib/database.types';

export const REACTION_EMOJIS = ['❤️', '🥹', '😍', '👏', '🎉'] as const;
export type ReactionEmoji = typeof REACTION_EMOJIS[number];

// ─── Milestone reactions ───────────────────────────────────────────────────────

export async function getMilestoneReactions(milestoneId: string): Promise<MilestoneReaction[]> {
  const { data, error } = await supabase
    .from('milestone_reactions')
    .select('*')
    .eq('milestone_id', milestoneId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertMilestoneReaction(params: {
  milestoneId: string;
  userId: string;
  emoji: string;
}): Promise<MilestoneReaction> {
  const { data, error } = await supabase
    .from('milestone_reactions')
    .upsert(
      { milestone_id: params.milestoneId, user_id: params.userId, emoji: params.emoji },
      { onConflict: 'milestone_id,user_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMilestoneReaction(milestoneId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('milestone_reactions')
    .delete()
    .eq('milestone_id', milestoneId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ─── Memory reactions ──────────────────────────────────────────────────────────

export async function getMemoryReactions(memoryId: string): Promise<MemoryReaction[]> {
  const { data, error } = await supabase
    .from('memory_reactions')
    .select('*')
    .eq('memory_id', memoryId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertMemoryReaction(params: {
  memoryId: string;
  userId: string;
  emoji: string;
}): Promise<MemoryReaction> {
  const { data, error } = await supabase
    .from('memory_reactions')
    .upsert(
      { memory_id: params.memoryId, user_id: params.userId, emoji: params.emoji },
      { onConflict: 'memory_id,user_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMemoryReaction(memoryId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('memory_reactions')
    .delete()
    .eq('memory_id', memoryId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ─── Grouped reaction summary helper ─────────────────────────────────────────

export interface ReactionSummary {
  emoji: string;
  count: number;
  reactedByCurrentUser: boolean;
}

export function groupReactions<T extends { emoji: string; user_id: string }>(
  reactions: T[],
  currentUserId: string | null,
): ReactionSummary[] {
  const counts = new Map<string, { count: number; byMe: boolean }>();
  for (const r of reactions) {
    const existing = counts.get(r.emoji) ?? { count: 0, byMe: false };
    counts.set(r.emoji, {
      count: existing.count + 1,
      byMe: existing.byMe || r.user_id === currentUserId,
    });
  }
  return [...counts.entries()].map(([emoji, { count, byMe }]) => ({
    emoji,
    count,
    reactedByCurrentUser: byMe,
  }));
}
