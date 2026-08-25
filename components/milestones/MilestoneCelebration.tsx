/**
 * MilestoneCelebration — a brief full-screen moment of joy shown immediately
 * after a milestone is saved. Auto-dismisses after 3 seconds.
 *
 * Research rationale: Positive emotional feedback at task completion dramatically
 * increases retention and repeat usage (Norman, Emotional Design). This is the
 * highest-emotional-value action in the app — it deserves a moment.
 */

import { useEffect } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts, MilestoneColors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { CATEGORY_EMOJIS, CATEGORY_LABELS } from '@/constants/milestone-templates';
import type { MilestoneCategory } from '@/lib/database.types';

interface MilestoneCelebrationProps {
  visible: boolean;
  title: string;
  category: MilestoneCategory;
  ageLabel?: string;
  onDismiss: () => void;
  onShare?: () => void;
}

export function MilestoneCelebration({
  visible,
  title,
  category,
  ageLabel,
  onDismiss,
  onShare,
}: MilestoneCelebrationProps) {
  useColorScheme(); // ensures correct scheme in hook call order
  const insets = useSafeAreaInsets();
  const accent = MilestoneColors[category];

  const emojiScale = useSharedValue(0);
  const titleOpacity = useSharedValue(0);

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emojiScale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  useEffect(() => {
    if (!visible) return;
    // Reanimated shared value mutation — intentional, runs on the UI thread
    // eslint-disable-next-line react-hooks/immutability
    emojiScale.value = withSequence(
      withSpring(1.3, { damping: 8, stiffness: 200 }),
      withSpring(1.0, { damping: 10, stiffness: 180 }),
    );
    // eslint-disable-next-line react-hooks/immutability
    titleOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [visible, emojiScale, titleOpacity, onDismiss]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(300)}
          style={[
            styles.card,
            {
              backgroundColor: accent + 'F0',
              paddingBottom: Math.max(insets.bottom + Spacing.xl, Spacing.xxl),
            },
          ]}>
          <Animated.Text style={[styles.emoji, emojiStyle]}>
            {CATEGORY_EMOJIS[category]}
          </Animated.Text>

          <Animated.View style={titleStyle}>
            <Text style={[styles.categoryLabel, { color: '#fff' }]}>
              {CATEGORY_LABELS[category]} milestone
            </Text>
            <Text style={[styles.title, { fontFamily: Fonts!.rounded }]} numberOfLines={3}>
              {title}
            </Text>
            {ageLabel && (
              <Text style={styles.age}>{ageLabel}</Text>
            )}
          </Animated.View>

          {onShare && (
            <Pressable
              style={styles.shareButton}
              onPress={onShare}
              accessibilityRole="button"
              accessibilityLabel="Share this milestone">
              <Text style={styles.shareText}>Share card ✨</Text>
            </Pressable>
          )}

          <Text style={styles.tapToDismiss}>Tap anywhere to continue</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  card: {
    width: '100%',
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  emoji: {
    fontSize: 72,
    textAlign: 'center',
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 32,
  },
  age: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.75,
    marginTop: 4,
  },
  shareButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 24,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 2,
    minHeight: 44,
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  shareText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  tapToDismiss: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.5,
    marginTop: Spacing.xs,
  },
});
