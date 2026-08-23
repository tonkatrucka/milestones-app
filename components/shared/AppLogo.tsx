import { Image } from 'expo-image';
import { StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

interface AppLogoProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function AppLogo({ size = 88, style }: AppLogoProps) {
  return (
    <Image
      source={require('@/assets/images/logo.png')}
      style={[styles.logo, { width: size, height: size, borderRadius: size * 0.22 }, style]}
      contentFit="contain"
      accessibilityLabel="Milestones logo"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    overflow: 'hidden',
  },
});
