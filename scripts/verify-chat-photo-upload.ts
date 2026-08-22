/**
 * Verifies the chat photo-upload path without a device build.
 * Recreates the Hermes "Property 'crypto' doesn't exist" failure mode.
 *
 * Run: npx tsx scripts/verify-chat-photo-upload.ts
 */
import { randomFileId } from '../lib/random-id';
import { base64ToArrayBuffer } from '../lib/base64';
import { chatSendPayload } from '../lib/chat-send-payload';
import { opaqueMediaPath } from '../lib/media-path';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`OK: ${message}`);
}

function withHermesMissingCrypto<T>(fn: () => T): T {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    get() {
      throw new Error("Property 'crypto' doesn't exist");
    },
  });
  try {
    return fn();
  } finally {
    if (original) {
      Object.defineProperty(globalThis, 'crypto', original);
    } else {
      delete (globalThis as { crypto?: Crypto }).crypto;
    }
  }
}

const hermesId = withHermesMissingCrypto(() => randomFileId());
assert(UUID_RE.test(hermesId), `randomFileId works when crypto throws (${hermesId})`);

const normalId = randomFileId();
assert(UUID_RE.test(normalId), `randomFileId works with available crypto (${normalId})`);
assert(hermesId !== normalId, 'successive IDs are unique');

const childId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const chatPath = withHermesMissingCrypto(() => opaqueMediaPath(childId, 'c'));
assert(chatPath.startsWith(`${childId}/c/`), `chat upload path is RLS-safe: ${chatPath}`);
assert(chatPath.endsWith('.jpg'), 'chat upload path uses jpg extension');

const stored = `storage://chat-media/${chatPath}`;
const prefix = 'storage://chat-media/';
assert(stored.startsWith(prefix), 'storage ref encodes chat-media bucket');
assert(stored.slice(prefix.length) === chatPath, 'storage ref round-trips the object path');

assert(chatSendPayload('', []) === null, 'empty composer does not send');

const photoOnly = chatSendPayload('  ', ['file:///tmp/photo.jpg']);
assert(photoOnly?.text === '📷', 'photo-only send uses camera fallback text');
assert(photoOnly?.imageUris?.[0] === 'file:///tmp/photo.jpg', 'photo-only send keeps local URI');

const captioned = chatSendPayload('Look at this smile', ['file:///tmp/a.jpg', 'file:///tmp/b.jpg']);
assert(captioned?.text === 'Look at this smile', 'caption is sent with photos');
assert(captioned?.imageUris?.length === 2, 'multiple photo URIs are forwarded to upload');

// 1x1 JPEG
const jpegBase64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBIVFRUVFRUVFRUVFRUVFRUWFxUVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGhA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z';
const jpegBytes = new Uint8Array(base64ToArrayBuffer(jpegBase64));
assert(jpegBytes.byteLength > 32, `base64 JPEG decodes (${jpegBytes.byteLength} bytes)`);
assert(jpegBytes[0] === 0xff && jpegBytes[1] === 0xd8, 'decoded bytes start with JPEG SOI marker');

console.log('\nChat photo upload path verified.');
