import { File } from 'expo-file-system';
import { supabase } from '@/lib/supabase';

/** Read a local file URI into an ArrayBuffer — required for Supabase Storage on React Native. */
async function readUriAsArrayBuffer(localUri: string): Promise<ArrayBuffer> {
  return new File(localUri).arrayBuffer();
}

async function uploadToBucket(
  bucket: string,
  path: string,
  localUri: string,
  mimeType: string,
  upsert = false,
): Promise<string> {
  const arrayBuffer = await readUriAsArrayBuffer(localUri);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, { contentType: mimeType, upsert });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadMilestoneMedia(
  childId: string,
  localUri: string,
  mimeType = 'image/jpeg',
): Promise<string> {
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const path = `${childId}/${filename}`;
  return uploadToBucket('milestone-media', path, localUri, mimeType);
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

export async function uploadMemoryMedia(
  childId: string,
  localUri: string,
  mimeType = 'image/jpeg',
): Promise<string> {
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const path = `memories/${childId}/${filename}`;
  return uploadToBucket('milestone-media', path, localUri, mimeType);
}

export async function uploadChatMedia(
  childId: string,
  localUri: string,
  mimeType = 'image/jpeg',
): Promise<string> {
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const path = `${childId}/${filename}`;
  return uploadToBucket('chat-media', path, localUri, mimeType);
}

export async function uploadChatMediaBatch(
  childId: string,
  localUris: string[],
): Promise<string[]> {
  return Promise.all(localUris.map((uri) => uploadChatMedia(childId, uri)));
}

export async function uploadChildAvatar(
  childId: string,
  localUri: string,
): Promise<string> {
  const path = `avatars/${childId}.jpg`;
  return uploadToBucket('milestone-media', path, localUri, 'image/jpeg', true);
}
