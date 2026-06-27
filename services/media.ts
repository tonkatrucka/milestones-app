import { File } from 'expo-file-system';
import { encodeStorageRef, storageBucketForObject, storageObjectPath } from '@/lib/media-ref';
import { supabase } from '@/lib/supabase';

const CHAT_BUCKET = 'chat-media';
const MILESTONE_BUCKET = 'milestone-media';

function opaquePath(prefix: string, ext = 'jpg'): string {
  return `${prefix}/${crypto.randomUUID()}.${ext}`;
}

/** Read a local file URI into an ArrayBuffer — required for Supabase Storage on React Native. */
async function readUriAsArrayBuffer(localUri: string): Promise<ArrayBuffer> {
  return new File(localUri).arrayBuffer();
}

async function uploadToBucket(
  bucket: string,
  path: string,
  localUri: string,
  mimeType: string,
  childId: string,
  upsert = false,
): Promise<string> {
  const arrayBuffer = await readUriAsArrayBuffer(localUri);

  const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, {
    contentType: mimeType,
    upsert,
    metadata: { child_id: childId },
  });

  if (error) throw error;

  if (bucket === CHAT_BUCKET) {
    return encodeStorageRef(bucket, path);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadMilestoneMedia(
  childId: string,
  localUri: string,
  mimeType = 'image/jpeg',
): Promise<string> {
  const path = opaquePath('m');
  return uploadToBucket(MILESTONE_BUCKET, path, localUri, mimeType, childId);
}

export async function deleteMilestoneMedia(stored: string): Promise<void> {
  const objectPath = storageObjectPath(stored);
  if (!objectPath) return;

  const bucket = storageBucketForObject(stored);
  const { error } = await supabase.storage.from(bucket).remove([objectPath]);
  if (error) throw error;
}

export async function uploadMemoryMedia(
  childId: string,
  localUri: string,
  mimeType = 'image/jpeg',
): Promise<string> {
  const path = opaquePath('mem');
  return uploadToBucket(MILESTONE_BUCKET, path, localUri, mimeType, childId);
}

export async function uploadChatMedia(
  childId: string,
  localUri: string,
  mimeType = 'image/jpeg',
): Promise<string> {
  const path = opaquePath('c');
  return uploadToBucket(CHAT_BUCKET, path, localUri, mimeType, childId);
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
  const path = opaquePath('a');
  return uploadToBucket(MILESTONE_BUCKET, path, localUri, 'image/jpeg', childId, true);
}
