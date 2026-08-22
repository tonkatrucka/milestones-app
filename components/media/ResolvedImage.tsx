import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';
import { Image, type ImageContentFit } from 'expo-image';
import { resolveMediaUrl } from '@/lib/media-ref';

interface ResolvedImageProps {
  stored: string;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  ttlSec?: number;
}

export function ResolvedImage({ stored, style, contentFit = 'cover', ttlSec }: ResolvedImageProps) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    setUri(null);
    setFailed(false);

    resolveMediaUrl(stored, ttlSec ? { ttlSec } : undefined)
      .then((resolved) => {
        if (!mounted) return;
        if (resolved) {
          setUri(resolved);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (mounted) setFailed(true);
      });

    return () => {
      mounted = false;
    };
  }, [stored, ttlSec]);

  if (failed) {
    return <View style={[styles.placeholder, style]} />;
  }

  if (!uri) {
    return (
      <View style={[styles.placeholder, style]}>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  return <Image source={{ uri }} style={style} contentFit={contentFit} />;
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
});
