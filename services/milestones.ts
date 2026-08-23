import { supabase } from '@/lib/supabase';
import { notifyTeamOfNewRecord } from '@/services/notify-team';
import type { Milestone, MilestoneCategory } from '@/lib/database.types';

export async function getMilestones(childId: string): Promise<Milestone[]> {
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .eq('child_id', childId)
    .order('achieved_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getMilestone(id: string): Promise<Milestone | null> {
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createMilestone(params: {
  childId: string;
  category: MilestoneCategory;
  title: string;
  description?: string;
  achievedAt: string;
  mediaUrls?: string[];
  audioUrl?: string;
  isPrivate?: boolean;
  userId: string;
}): Promise<Milestone> {
  const { data, error } = await supabase
    .from('milestones')
    .insert({
      child_id: params.childId,
      category: params.category,
      title: params.title,
      description: params.description ?? null,
      achieved_at: params.achievedAt,
      media_urls: params.mediaUrls ?? [],
      audio_url: params.audioUrl ?? null,
      is_private: params.isPrivate ?? false,
      created_by: params.userId,
    })
    .select()
    .single();

  if (error) throw error;

  void notifyTeamOfNewRecord({
    childId: params.childId,
    recordType: 'milestone',
    createdByUserId: params.userId,
    summary: params.title,
    recordId: data.id,
  });

  return data;
}

export async function updateMilestone(
  id: string,
  updates: {
    title?: string;
    description?: string | null;
    achievedAt?: string;
    mediaUrls?: string[];
    audioUrl?: string | null;
    isPrivate?: boolean;
    category?: MilestoneCategory;
  },
): Promise<Milestone> {
  const { data, error } = await supabase
    .from('milestones')
    .update({
      ...(updates.title !== undefined && { title: updates.title }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.achievedAt !== undefined && { achieved_at: updates.achievedAt }),
      ...(updates.mediaUrls !== undefined && { media_urls: updates.mediaUrls }),
      ...(updates.audioUrl !== undefined && { audio_url: updates.audioUrl }),
      ...(updates.isPrivate !== undefined && { is_private: updates.isPrivate }),
      ...(updates.category !== undefined && { category: updates.category }),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMilestone(id: string): Promise<void> {
  const { error } = await supabase.from('milestones').delete().eq('id', id);
  if (error) throw error;
}
