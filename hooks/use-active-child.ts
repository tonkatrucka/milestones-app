import { useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/app-store';

/**
 * Kept for backwards compat — called by useAuth on sign-out to clear
 * the Zustand store. The fetch itself is now gated on userId so it
 * automatically re-runs when a new session arrives.
 */
export function resetChildrenCache() {}

/**
 * Loads the authenticated user's children from Supabase.
 *
 * Pass the current session's user ID so the effect re-runs whenever
 * the user changes (login / account switch). When userId is null the
 * hook does nothing — preventing the previous race where children were
 * queried before the session was restored from AsyncStorage.
 */
export function useActiveChild(userId: string | null) {
  const { children, activeChildId, isChildrenLoading, setChildren, setIsChildrenLoading } =
    useAppStore();
  const activeChild = useAppStore((s) => s.activeChild());

  const fetchChildren = useCallback(() => {
    if (!userId) {
      setIsChildrenLoading(false);
      return;
    }

    setIsChildrenLoading(true);
    supabase
      .from('children')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('[useActiveChild] query failed:', error.message);
        } else {
          setChildren(data ?? []);
        }
        setIsChildrenLoading(false);
      });
  }, [userId, setChildren, setIsChildrenLoading]);

  useEffect(() => {
    if (!userId) {
      setIsChildrenLoading(false);
      return;
    }
    fetchChildren();
  }, [userId, fetchChildren]);

  return { children, activeChildId, activeChild, isChildrenLoading, refreshChildren: fetchChildren };
}
