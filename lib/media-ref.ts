import { supabase } from '@/lib/supabase';

/** Stored reference to a private or resolvable storage object (not a fetchable URL). */
export const STORAGE_REF_PREFIX = 'storage://';

const CHAT_BUCKET = 'chat-media';
const MILESTONE_BUCKET = 'milestone-media';

/** Display / share — refresh before expiry when re-opening old screens. */
const SIGNED_URL_TTL_SEC = 60 * 60 * 24;

/** Anthropic fetch window for chat images. */
export const CHAT_API_SIGNED_URL_TTL_SEC = 60 * 60;

export function isStorageRef(value: string): boolean {
  return value.startsWith(STORAGE_REF_PREFIX);
}

export function encodeStorageRef(bucket: string, path: string): string {
  return `${STORAGE_REF_PREFIX}${bucket}/${path}`;
}

export function parseStorageRef(ref: string): { bucket: string; path: string } | null {
  if (!isStorageRef(ref)) return null;
  const rest = ref.slice(STORAGE_REF_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

export async function resolveMediaUrl(
  stored: string,
  options?: { ttlSec?: number },
): Promise<string> {
  if (!stored || !isStorageRef(stored)) return stored;

  const parsed = parseStorageRef(stored);
  if (!parsed) return stored;

  const ttl = options?.ttlSec ?? SIGNED_URL_TTL_SEC;
  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, ttl);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'Failed to resolve media URL');
  }
  return data.signedUrl;
}

export async function resolveMediaUrls(
  stored: string[],
  options?: { ttlSec?: number },
): Promise<string[]> {
  return Promise.all(stored.map((s) => resolveMediaUrl(s, options)));
}

/** Path within bucket for delete operations (storage ref or legacy public URL). */
export function storageObjectPath(stored: string, defaultBucket = MILESTONE_BUCKET): string | null {
  const ref = parseStorageRef(stored);
  if (ref) return ref.path;

  if (!stored.startsWith('http')) return null;

  try {
    const urlObj = new URL(stored);
    for (const bucket of [MILESTONE_BUCKET, CHAT_BUCKET]) {
      const marker = `/storage/v1/object/public/${bucket}/`;
      const signedMarker = `/storage/v1/object/sign/${bucket}/`;
      const publicIdx = urlObj.pathname.indexOf(marker);
      if (publicIdx >= 0) {
        return decodeURIComponent(urlObj.pathname.slice(publicIdx + marker.length));
      }
      const signedIdx = urlObj.pathname.indexOf(signedMarker);
      if (signedIdx >= 0) {
        return decodeURIComponent(urlObj.pathname.slice(signedIdx + signedMarker.length).split('?')[0]);
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function storageBucketForObject(stored: string, defaultBucket = MILESTONE_BUCKET): string {
  const ref = parseStorageRef(stored);
  if (ref) return ref.bucket;

  if (stored.includes(`/${CHAT_BUCKET}/`)) return CHAT_BUCKET;
  return defaultBucket;
}
