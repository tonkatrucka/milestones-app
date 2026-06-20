import { supabase } from '@/lib/supabase';

export async function uploadMilestoneMedia(
  childId: string,
  localUri: string,
  mimeType = 'image/jpeg',
): Promise<string> {
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const path = `${childId}/${filename}`;

  const response = await fetch(localUri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from('milestone-media')
    .upload(path, blob, { contentType: mimeType, upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from('milestone-media').getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteMilestoneMedia(url: string): Promise<void> {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/milestone-media/');
  if (pathParts.length < 2) return;

  const { error } = await supabase.storage
    .from('milestone-media')
    .remove([pathParts[1]]);

  if (error) throw error;
}

export async function uploadChildAvatar(
  childId: string,
  localUri: string,
): Promise<string> {
  const path = `avatars/${childId}.jpg`;

  const response = await fetch(localUri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from('milestone-media')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from('milestone-media').getPublicUrl(path);
  return data.publicUrl;
}
