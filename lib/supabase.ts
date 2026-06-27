import { createClient } from '@supabase/supabase-js';
import { getSupabasePublicConfig } from '@/lib/public-env';
import { supabaseAuthStorage } from '@/lib/supabase-storage';

const { url: supabaseUrl, anonKey: supabaseAnonKey, configured } = getSupabasePublicConfig();

export const isSupabaseConfigured = configured;

// During Expo Router's SSR pass (Node.js), `window` is undefined.
// Passing `undefined` storage prevents the auth adapter from being called
// server-side and crashing with "ReferenceError: window is not defined".
const isSSR = typeof window === 'undefined';

// Avoid createClient() throwing on launch when EAS env was not inlined into the build.
const clientUrl = configured ? supabaseUrl : 'https://invalid.local';
const clientKey = configured ? supabaseAnonKey : 'invalid-anon-key';

export const supabase = createClient(clientUrl, clientKey, {
  auth: {
    storage: isSSR ? undefined : supabaseAuthStorage,
    autoRefreshToken: !isSSR,
    persistSession: !isSSR,
    detectSessionInUrl: false,
  },
});
