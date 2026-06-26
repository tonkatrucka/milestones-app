/** Supabase public config baked in at EAS build time (EXPO_PUBLIC_*). */
export function getSupabasePublicConfig() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

  const configured =
    url.startsWith('https://') &&
    anonKey.length > 20 &&
    !url.startsWith('@') &&
    !anonKey.startsWith('@');

  return { url, anonKey, configured };
}
