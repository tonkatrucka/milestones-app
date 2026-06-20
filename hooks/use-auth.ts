import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/app-store';
import { resetChildrenCache } from '@/hooks/use-active-child';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const reset = useAppStore((s) => s.reset);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setIsLoading(false);
      })
      .catch(() => {
        // Network failure or invalid credentials — treat as logged out
        setSession(null);
        setIsLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        reset();
        resetChildrenCache();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, isLoading, signOut };
}
