import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { ResolvedImage } from '@/components/media/ResolvedImage';

type ChildAvatarProps = {
  avatarUrl: string | null;
  localUri?: string | null;
  size?: number;
  accentColor?: string;
};

export function ChildAvatar({
  avatarUrl,
  localUri,
  size = 40,
  accentColor = '#888',
}: ChildAvatarProps) {
  const imageStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (localUri) {
    return <Image source={{ uri: localUri }} style={imageStyle} contentFit="cover" />;
  }

  if (avatarUrl) {
    return <ResolvedImage stored={avatarUrl} style={imageStyle} contentFit="cover" />;
  }

  return (
    <View style={[imageStyle, styles.placeholder, { backgroundColor: accentColor + '22' }]}>
      <Text style={[styles.emoji, { fontSize: size * 0.45 }]}>👶</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    lineHeight: undefined,
  },
});
