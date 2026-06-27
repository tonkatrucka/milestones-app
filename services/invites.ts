import { Share } from 'react-native';
import { supabase } from '@/lib/supabase';
import { buildInviteUrl } from '@/lib/invite-links';
import type { Invite, MemberRole } from '@/lib/database.types';

export interface ChildMemberWithEmail {
  user_id: string;
  role: MemberRole;
  email: string;
  created_at: string;
}

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
      email: params.email.trim().toLowerCase(),
      role: params.role,
      created_by: params.userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPendingInvitesForChild(childId: string): Promise<Invite[]> {
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .eq('child_id', childId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function acceptInvite(token: string): Promise<void> {
  const { error } = await supabase.rpc('accept_invite', { invite_token: token });
  if (error) throw error;
}

export async function listChildMembers(childId: string): Promise<ChildMemberWithEmail[]> {
  const { data, error } = await supabase.rpc('list_child_members', { p_child_id: childId });
  if (error) throw error;
  return (data ?? []) as ChildMemberWithEmail[];
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.from('invites').delete().eq('id', inviteId);
  if (error) throw error;
}

export async function updateMemberRole(
  childId: string,
  userId: string,
  role: 'caregiver' | 'viewer',
): Promise<void> {
  const { error } = await supabase.rpc('update_member_role', {
    p_child_id: childId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
}

export async function updateInviteRole(
  inviteId: string,
  role: 'caregiver' | 'viewer',
): Promise<void> {
  const { error } = await supabase.from('invites').update({ role }).eq('id', inviteId);
  if (error) throw error;
}

export async function transferChildOwnership(
  childId: string,
  newOwnerId: string,
): Promise<void> {
  const { error } = await supabase.rpc('transfer_child_ownership', {
    p_child_id: childId,
    p_new_owner_id: newOwnerId,
  });
  if (error) throw error;
}

export async function removeMember(childId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('child_members')
    .delete()
    .eq('child_id', childId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function shareInviteLink(params: {
  token: string;
  childName: string;
  role: MemberRole;
}): Promise<void> {
  const url = buildInviteUrl(params.token);
  const roleLabel = params.role === 'caregiver' ? 'caregiver' : 'viewer';
  await Share.share({
    message: `You've been invited to ${params.childName}'s profile on Milestones as a ${roleLabel}.\n\n${url}`,
    url,
    title: `Join ${params.childName} on Milestones`,
  });
}
