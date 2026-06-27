import { useEffect, useState } from 'react';
import { resolveMediaUrls } from '@/lib/media-ref';

export function useResolvedMediaUrls(stored: string[], ttlSec?: number) {
  const [urls, setUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(stored.length > 0);
  const key = stored.join('\0');

  useEffect(() => {
    if (stored.length === 0) {
      setUrls([]);
      setIsLoading(false);
      return;
    }

    let mounted = true;
    setIsLoading(true);
    resolveMediaUrls(stored, ttlSec ? { ttlSec } : undefined)
      .then((resolved) => {
        if (mounted) {
          setUrls(resolved);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setUrls([]);
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [key, ttlSec]);

  return { urls, isLoading };
}
