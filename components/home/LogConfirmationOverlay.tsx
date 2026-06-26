import { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, EventColors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  EVENT_EMOJIS,
  EVENT_LABELS,
  formatEventTime,
  getEventDetail,
} from '@/lib/event-display';
import type { EventType } from '@/lib/database.types';
import { useLogConfirmationStore, type LayoutRect } from '@/store/log-confirmation-store';

const CHIP_W = Dimensions.get('window').width - 48;
const CHIP_H = 52;
const PHASE_A_MS = 350;
const PHASE_B_MS = 650;

function resolvePoints(origin: LayoutRect | undefined, timelineTop: LayoutRect | null) {
  const { width: SW, height: SH } = Dimensions.get('window');
  const from = origin ?? {
    x: (SW - CHIP_W) / 2,
    y: SH * 0.32,
    width: CHIP_W,
    height: CHIP_H,
  };
  const endX = timelineTop
    ? timelineTop.x + (timelineTop.width - CHIP_W) / 2
    : (SW - CHIP_W) / 2;
  const endY = timelineTop ? timelineTop.y + Spacing.xs : SH * 0.55;
  return {
    startX: from.x + (from.width - CHIP_W) / 2,
    startY: from.y + (from.height - CHIP_H) / 2,
    endX,
    endY,
  };
}

function EventChip({
  type,
  detail,
  time,
  accent,
  colors,
}: {
  type: EventType;
  detail: string;
  time: string;
  accent: string;
  colors: typeof Colors.light;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: colors.card, borderColor: accent + '44' }]}>
      <View style={[styles.checkBadge, { backgroundColor: accent }]}>
        <Ionicons name="checkmark" size={12} color="#fff" />
      </View>
      <Text style={styles.chipEmoji}>{EVENT_EMOJIS[type]}</Text>
      <View style={styles.chipBody}>
        <View style={styles.chipLabelRow}>
          <Text style={[styles.chipType, { color: colors.text }]}>{EVENT_LABELS[type]}</Text>
          {detail ? (
            <View style={[styles.detailPill, { backgroundColor: accent + '18' }]}>
              <Text style={[styles.detailText, { color: accent }]} numberOfLines={1}>
                {detail}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.chipTime, { color: colors.muted }]}>{time}</Text>
      </View>
    </View>
  );
}

export function LogConfirmationOverlay() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const pending = useLogConfirmationStore((s) => s.pending);
  const timelineTop = useLogConfirmationStore((s) => s.timelineTop);
  const clear = useLogConfirmationStore((s) => s.clear);

  const progress = useSharedValue(0);
  const fly = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const endX = useSharedValue(0);
  const endY = useSharedValue(0);

  const finish = () => {
    clear();
  };

  useEffect(() => {
    if (!pending) {
      progress.value = 0;
      fly.value = 0;
      return;
    }

    const pts = resolvePoints(pending.origin, timelineTop);
    startX.value = pts.startX;
    startY.value = pts.startY;
    endX.value = pts.endX;
    endY.value = pts.endY;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    progress.value = 0;
    fly.value = 0;
    progress.value = withTiming(1, { duration: PHASE_A_MS });
    fly.value = withDelay(
      PHASE_A_MS,
      withTiming(1, { duration: PHASE_B_MS }, (finished) => {
        if (finished) runOnJS(finish)();
      }),
    );
  }, [pending?.key, pending?.origin, timelineTop, clear, endX, endY, fly, progress, startX, startY]);

  const animatedStyle = useAnimatedStyle(() => {
    const x = startX.value + (endX.value - startX.value) * fly.value;
    const y = startY.value + (endY.value - startY.value) * fly.value;
    const appearScale = 0.9 + progress.value * 0.1;
    const flyScale = 1 - fly.value * 0.15;
    const scale = appearScale * flyScale;
    const opacity = progress.value * (1 - fly.value);

    return {
      opacity,
      transform: [{ translateX: x }, { translateY: y }, { scale }],
    };
  });

  if (!pending) return null;

  const { event } = pending;
  const accent = EventColors[event.type as EventType];
  const detail = getEventDetail(event);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.chipWrap, animatedStyle]}>
        <EventChip
          type={event.type as EventType}
          detail={detail}
          time={formatEventTime(event)}
          accent={accent}
          colors={colors}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  chipWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: CHIP_W,
    height: CHIP_H,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipEmoji: {
    fontSize: 18,
  },
  chipBody: {
    flex: 1,
    gap: 1,
  },
  chipLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  chipType: {
    fontSize: 14,
    fontWeight: '700',
  },
  detailPill: {
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    maxWidth: '65%',
  },
  detailText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipTime: {
    fontSize: 11,
    fontWeight: '500',
  },
});
