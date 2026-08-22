import { File } from 'expo-file-system';
import { EncodingType, readAsStringAsync } from 'expo-file-system/legacy';
import { encodeStorageRef, storageBucketForObject, storageObjectPath } from '@/lib/media-ref';
import { opaqueMediaPath } from '@/lib/media-path';
import { base64ToArrayBuffer } from '@/lib/base64';
import { supabase } from '@/lib/supabase';

const CHAT_BUCKET = 'chat-media';
const MILESTONE_BUCKET = 'milestone-media';

/** Read a local file URI into an ArrayBuffer — required for Supabase Storage on React Native. */
export async function readUriAsArrayBuffer(localUri: string): Promise<ArrayBuffer> {
  try {
    return await new File(localUri).arrayBuffer();
  } catch {
    // Image-picker URIs (content://, ph://) often fail the new File API.
  }

  try {
    const response = await fetch(localUri);
    if (response.ok) {
      return await response.arrayBuffer();
    }
  } catch {
    // Fall through to the legacy Base64 reader.
  }

  const base64 = await readAsStringAsync(localUri, { encoding: EncodingType.Base64 });
  return base64ToArrayBuffer(base64);
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
  const path = opaqueMediaPath(childId, 'm');
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
  const path = opaqueMediaPath(childId, 'mem');
  return uploadToBucket(MILESTONE_BUCKET, path, localUri, mimeType, childId);
}

export async function uploadChatMedia(
  childId: string,
  localUri: string,
  mimeType = 'image/jpeg',
): Promise<string> {
  const path = opaqueMediaPath(childId, 'c');
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
  const path = opaqueMediaPath(childId, 'a');
  return uploadToBucket(MILESTONE_BUCKET, path, localUri, 'image/jpeg', childId, true);
}
