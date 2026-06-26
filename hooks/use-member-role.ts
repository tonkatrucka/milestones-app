import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { MemberRole } from '@/lib/database.types';

function memberKey(childId: string | null, userId: string | null) {
  return childId && userId ? `${childId}:${userId}` : null;
}

export function useMemberRole(childId: string | null, userId: string | null) {
  const [role, setRole] = useState<MemberRole | null>(null);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const currentKey = memberKey(childId, userId);
  const isLoading = currentKey !== null && resolvedKey !== currentKey;

  useEffect(() => {
    if (!childId || !userId) {
      setRole(null);
      setResolvedKey(null);
      return;
    }

    const key = memberKey(childId, userId)!;
    let mounted = true;
    setRole(null);

    supabase
      .from('child_members')
      .select('role')
      .eq('child_id', childId)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error('[useMemberRole]', error.message);
          setRole(null);
        } else {
          setRole((data?.role as MemberRole) ?? null);
        }
        setResolvedKey(key);
      });

    return () => {
      mounted = false;
    };
  }, [childId, userId]);

  return {
    role,
    isLoading,
    isOwner: role === 'owner',
    canWrite: role === 'owner' || role === 'caregiver',
  };
}

/** Redirects viewers away from write-only screens (e.g. new milestone). */
export function useRequireCanWrite(childId: string | null, userId: string | null) {
  const router = useRouter();
  const { canWrite, isLoading } = useMemberRole(childId, userId);

  useEffect(() => {
    if (!isLoading && childId && userId && !canWrite) {
      router.replace('/(tabs)' as never);
    }
  }, [canWrite, isLoading, childId, userId, router]);

  return { canWrite, isLoading };
}
