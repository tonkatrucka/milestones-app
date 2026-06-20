import { supabase } from '@/lib/supabase';
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
      created_by: params.userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMilestone(
  id: string,
  updates: {
    title?: string;
    description?: string;
    achieved_at?: string;
    media_urls?: string[];
  },
): Promise<Milestone> {
  const { data, error } = await supabase
    .from('milestones')
    .update(updates)
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
