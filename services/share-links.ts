import { supabase } from '@/lib/supabase';
import type { ShareLink } from '@/lib/database.types';

export async function createShareLink(params: {
  childId: string;
  contentId: string;
  contentType: 'milestone' | 'memory';
  userId: string;
  maxViews?: number;
}): Promise<ShareLink> {
  const { data, error } = await supabase
    .from('share_links')
    .insert({
      child_id: params.childId,
      content_id: params.contentId,
      content_type: params.contentType,
      created_by: params.userId,
      max_views: params.maxViews ?? 30,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getShareLinksForChild(childId: string): Promise<ShareLink[]> {
  const { data, error } = await supabase
    .from('share_links')
    .select('*')
    .eq('child_id', childId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function revokeShareLink(id: string): Promise<void> {
  const { error } = await supabase
    .from('share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export function buildShareLinkUrl(token: string): string {
  // In production this would be a universal link pointing to a web app / edge function.
  // For now we use the Supabase edge function URL pattern.
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  return `${supabaseUrl}/functions/v1/share-view?token=${token}`;
}
