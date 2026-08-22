import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type SkeletonSize = number | `${number}%`;

interface SkeletonProps {
  width?: SkeletonSize;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height, borderRadius = Radius.sm, style }: SkeletonProps) {
  const scheme = useColorScheme() ?? 'light';
  const progress = useSharedValue(0);
  const baseColor = scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const highlightColor = scheme === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.55)';

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [progress]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [-120, 120]),
      },
    ],
  }));

  return (
    <View
      style={[
        styles.bone,
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
        },
        style,
      ]}>
      <Animated.View
        style={[
          styles.shimmer,
          { backgroundColor: highlightColor },
          shimmerStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bone: {
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '45%',
    opacity: 0.9,
  },
});
