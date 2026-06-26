import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors, EventColors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { EVENT_EMOJIS, EVENT_LABELS, formatEventTime, getEventDetail } from '@/lib/event-display';
import type { DailyEvent, EventType } from '@/lib/database.types';

type ActivityDay = 'today' | 'yesterday';

interface TodayFeedProps {
  events: DailyEvent[];
  yesterdayEvents?: DailyEvent[];
  title?: string;
  emptyText?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  highlightEventId?: string;
  forceToday?: boolean;
  onEventLongPress?: (event: DailyEvent) => void;
}

export function TodayFeed({
  events,
  yesterdayEvents,
  title = "Today's activity",
  emptyText = 'No events logged yet today',
  collapsible = false,
  defaultCollapsed = false,
  highlightEventId,
  forceToday = false,
  onEventLongPress,
}: TodayFeedProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [selectedDay, setSelectedDay] = useState<ActivityDay>('today');

  const showDayToggle = yesterdayEvents !== undefined;
  const activeDay = forceToday ? 'today' : selectedDay;
  const activeEvents = showDayToggle && activeDay === 'yesterday' ? yesterdayEvents : events;
  const activeEmptyText =
    showDayToggle && activeDay === 'yesterday'
      ? 'No events logged yesterday'
      : emptyText;

  const sorted = [...(activeEvents ?? [])].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );

  return (
    <View style={styles.container}>
      {showDayToggle ? (
        <DayToggle
          selected={activeDay}
          onSelect={forceToday ? () => {} : setSelectedDay}
          colors={colors}
        />
      ) : (
        <Pressable
          style={styles.headingRow}
          onPress={collapsible ? () => setCollapsed((v) => !v) : undefined}
          disabled={!collapsible}>
          <Text style={[styles.heading, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            {title}
          </Text>
          {collapsible && (
            <Ionicons
              name={collapsed ? 'chevron-down' : 'chevron-up'}
              size={16}
              color={colors.muted}
            />
          )}
        </Pressable>
      )}

      {(!collapsible || !collapsed) && (
        sorted.length === 0 ? (
          <View style={[styles.card, styles.emptyCard, { backgroundColor: colors.card }]}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>{activeEmptyText}</Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.recentLabel, { color: colors.muted }]}>Most Recent</Text>
            {sorted.map((event, idx) => (
              <TimelineRow
                key={event.id}
                event={event}
                isLast={idx === sorted.length - 1}
                isHighlighted={event.id === highlightEventId}
                colors={colors}
                onLongPress={onEventLongPress ? () => onEventLongPress(event) : undefined}
              />
            ))}
          </View>
        )
      )}
    </View>
  );
}

function DayToggle({
  selected,
  onSelect,
  colors,
}: {
  selected: ActivityDay;
  onSelect: (day: ActivityDay) => void;
  colors: typeof Colors.light;
}) {
  const options: { key: ActivityDay; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
  ];

  return (
    <View style={[styles.toggleTrack, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {options.map((opt) => {
        const active = selected === opt.key;
        return (
          <Pressable
            key={opt.key}
            style={[styles.toggleOption, active && { backgroundColor: colors.elevated }]}
            onPress={() => onSelect(opt.key)}>
            <Text
              style={[
                styles.toggleLabel,
                { color: active ? colors.text : colors.muted },
                active && styles.toggleLabelActive,
              ]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TimelineRow({
  event,
  isLast,
  isHighlighted,
  colors,
  onLongPress,
}: {
  event: DailyEvent;
  isLast: boolean;
  isHighlighted: boolean;
  colors: typeof Colors.light;
  onLongPress?: () => void;
}) {
  const accent = EventColors[event.type as EventType];
  const detail = getEventDetail(event);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!isHighlighted) return;
    pulse.value = withSequence(
      withTiming(1.03, { duration: 180 }),
      withTiming(1, { duration: 220 }),
    );
  }, [isHighlighted, pulse]);

  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const content = (
    <Pressable
      style={styles.row}
      onLongPress={onLongPress}
      delayLongPress={400}
      android_ripple={onLongPress ? { color: accent + '22', borderless: false } : null}>
      <View style={styles.gutter}>
        {!isLast && <View style={[styles.line, { backgroundColor: colors.border }]} />}
        <View style={[styles.dot, { backgroundColor: accent, borderColor: colors.card }]} />
      </View>
      <View style={[styles.content, !isLast && { borderBottomColor: colors.border }]}>
        <View style={styles.labelRow}>
          <Text style={styles.emoji}>{EVENT_EMOJIS[event.type as EventType]}</Text>
          <Text style={[styles.typeLabel, { color: colors.text }]}>
            {EVENT_LABELS[event.type as EventType]}
          </Text>
          {detail ? (
            <View style={[styles.detailPill, { backgroundColor: accent + '18' }]}>
              <Text style={[styles.detailText, { color: accent }]}>{detail}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.time, { color: colors.muted }]}>{formatEventTime(event)}</Text>
      </View>
    </Pressable>
  );

  if (isHighlighted) {
    return (
      <Animated.View collapsable={false} entering={FadeInDown.duration(280)}>
        <Animated.View style={highlightStyle}>{content}</Animated.View>
      </Animated.View>
    );
  }

  return content;
}

const DOT_SIZE = 12;
const GUTTER_W = 32;

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
  },
  toggleTrack: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 2,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Fonts!.rounded,
  },
  toggleLabelActive: {
    fontWeight: '700',
  },
  card: {
    borderRadius: Radius.lg,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  recentLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingBottom: Spacing.xs,
    paddingLeft: GUTTER_W,
  },
  row: {
    flexDirection: 'row',
    minHeight: 48,
  },
  gutter: {
    width: GUTTER_W,
    alignItems: 'center',
    position: 'relative',
  },
  line: {
    position: 'absolute',
    top: (48 - DOT_SIZE) / 2 + DOT_SIZE + 2,
    bottom: 0,
    width: 2,
    left: GUTTER_W / 2 - 1,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    marginTop: (48 - DOT_SIZE) / 2,
    borderWidth: 2,
    zIndex: 1,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
    gap: Spacing.sm,
  },
  labelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  emoji: {
    fontSize: 15,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailPill: {
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  detailText: {
    fontSize: 12,
    fontWeight: '600',
  },
  time: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 0,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
  },
  emptyEmoji: {
    fontSize: 28,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
