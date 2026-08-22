function uuidFromBytes(bytes: Uint8Array): string {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function mathRandomBytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/**
 * UUID for storage object names.
 * Hermes throws `Property 'crypto' doesn't exist` on a bare `crypto` lookup
 * (and sometimes on `globalThis.crypto`), so every Web Crypto access is guarded.
 */
export function randomFileId(): string {
  try {
    const webCrypto = globalThis.crypto;
    if (typeof webCrypto?.randomUUID === 'function') {
      return webCrypto.randomUUID();
    }
    if (typeof webCrypto?.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      webCrypto.getRandomValues(bytes);
      return uuidFromBytes(bytes);
    }
  } catch {
    // Hermes missing-global throw
  }
  return uuidFromBytes(mathRandomBytes());
}
