/** Supabase PostgrestError and similar API errors expose `message` but are not `Error` instances. */
export function getErrorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = (e as { message: unknown }).message;
    if (typeof msg === 'string' && msg.length > 0) return msg;
  }
  if (e instanceof Error) return e.message;
  return fallback;
}
