import { supabase } from '@/lib/supabase';
import type { MilestoneComment, MemoryComment } from '@/lib/database.types';

export async function getMilestoneComments(milestoneId: string): Promise<MilestoneComment[]> {
  const { data, error } = await supabase
    .from('milestone_comments')
    .select('*')
    .eq('milestone_id', milestoneId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addMilestoneComment(params: {
  milestoneId: string;
  userId: string;
  body: string;
}): Promise<MilestoneComment> {
  const { data, error } = await supabase
    .from('milestone_comments')
    .insert({
      milestone_id: params.milestoneId,
      user_id: params.userId,
      body: params.body.trim().slice(0, 500),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMilestoneComment(id: string): Promise<void> {
  const { error } = await supabase.from('milestone_comments').delete().eq('id', id);
  if (error) throw error;
}

export async function getMemoryComments(memoryId: string): Promise<MemoryComment[]> {
  const { data, error } = await supabase
    .from('memory_comments')
    .select('*')
    .eq('memory_id', memoryId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addMemoryComment(params: {
  memoryId: string;
  userId: string;
  body: string;
}): Promise<MemoryComment> {
  const { data, error } = await supabase
    .from('memory_comments')
    .insert({
      memory_id: params.memoryId,
      user_id: params.userId,
      body: params.body.trim().slice(0, 500),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMemoryComment(id: string): Promise<void> {
  const { error } = await supabase.from('memory_comments').delete().eq('id', id);
  if (error) throw error;
}
