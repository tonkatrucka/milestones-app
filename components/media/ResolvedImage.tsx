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

  useEffect(() => {
    let mounted = true;
    resolveMediaUrl(stored, ttlSec ? { ttlSec } : undefined)
      .then((resolved) => {
        if (mounted) setUri(resolved);
      })
      .catch(() => {
        if (mounted) setUri(null);
      });
    return () => {
      mounted = false;
    };
  }, [stored, ttlSec]);

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
  },
});
