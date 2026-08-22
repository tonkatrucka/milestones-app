const TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decode a Base64 string to an ArrayBuffer without Node's Buffer. */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const cleaned = base64.replace(/[\r\n\s]/g, '');
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  let outputLength = Math.floor((cleaned.length * 3) / 4);
  if (cleaned.endsWith('==')) outputLength -= 2;
  else if (cleaned.endsWith('=')) outputLength -= 1;

  const bytes = new Uint8Array(outputLength);
  let byteIndex = 0;
  for (let i = 0; i < cleaned.length; i += 4) {
    const encoded1 = TABLE.indexOf(cleaned[i]);
    const encoded2 = TABLE.indexOf(cleaned[i + 1]);
    const encoded3 = TABLE.indexOf(cleaned[i + 2]);
    const encoded4 = TABLE.indexOf(cleaned[i + 3]);
    bytes[byteIndex++] = (encoded1 << 2) | (encoded2 >> 4);
    if (cleaned[i + 2] !== '=' && byteIndex < bytes.length) {
      bytes[byteIndex++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (cleaned[i + 3] !== '=' && byteIndex < bytes.length) {
      bytes[byteIndex++] = ((encoded3 & 3) << 6) | encoded4;
    }
  }
  return bytes.buffer;
}
