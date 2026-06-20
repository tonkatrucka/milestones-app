import { supabase } from '@/lib/supabase';
import type { Invite, MemberRole } from '@/lib/database.types';

export async function createInvite(params: {
  childId: string;
  email: string;
  role: MemberRole;
  userId: string;
}): Promise<Invite> {
  const { data, error } = await supabase
    .from('invites')
    .insert({
      child_id: params.childId,
      email: params.email,
      role: params.role,
      created_by: params.userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getInvitesForChild(childId: string): Promise<Invite[]> {
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .eq('child_id', childId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function acceptInvite(token: string): Promise<void> {
  const { error } = await supabase.rpc('accept_invite', { invite_token: token });
  if (error) throw error;
}

export async function getMembersForChild(childId: string) {
  const { data, error } = await supabase
    .from('child_members')
    .select('*')
    .eq('child_id', childId);

  if (error) throw error;
  return data ?? [];
}

export async function removeMember(childId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('child_members')
    .delete()
    .eq('child_id', childId)
    .eq('user_id', userId);

  if (error) throw error;
}
