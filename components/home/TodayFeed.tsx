import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, differenceInMinutes } from 'date-fns';
import { Colors, EventColors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { DailyEvent, EventType, NappyMetadata, MealMetadata, SleepMetadata } from '@/lib/database.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<EventType, string> = { nappy: 'Nappy', meal: 'Meal', sleep: 'Sleep' };
const EVENT_EMOJIS: Record<EventType, string> = { nappy: '🧷', meal: '🍼', sleep: '😴' };

function getEventDetail(event: DailyEvent): string {
  const meta = event.metadata as Record<string, unknown>;
  switch (event.type) {
    case 'nappy': {
      const m = meta as Partial<NappyMetadata>;
      return m.nappyType ? m.nappyType.charAt(0).toUpperCase() + m.nappyType.slice(1) : '';
    }
    case 'meal': {
      const m = meta as Partial<MealMetadata>;
      const parts: string[] = [];
      if (m.mealType) parts.push(m.mealType.charAt(0).toUpperCase() + m.mealType.slice(1));
      if (m.amountMl) parts.push(`${m.amountMl}ml`);
      if (m.food) parts.push(m.food);
      return parts.join(' · ');
    }
    case 'sleep': {
      const m = meta as Partial<SleepMetadata>;
      if (m.sleepEnd) {
        const mins = Math.max(0, differenceInMinutes(new Date(m.sleepEnd), new Date(event.occurred_at)));
        if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? ` ${mins % 60}m` : ''}`.trim();
        return `${mins}m`;
      }
      return 'Ongoing';
    }
    default:
      return '';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TodayFeedProps {
  events: DailyEvent[];
  title?: string;
  emptyText?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  onEventLongPress?: (event: DailyEvent) => void;
}

export function TodayFeed({
  events,
  title = "Today's activity",
  emptyText = 'No events logged yet today',
  collapsible = false,
  defaultCollapsed = false,
  onEventLongPress,
}: TodayFeedProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  // Sort ascending so the timeline reads top=oldest, bottom=most recent
  const sorted = [...events].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
  );

  return (
    <View style={styles.container}>
      {/* Heading row — tappable when collapsible */}
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

      {!collapsed && (
        sorted.length === 0 ? (
          <View style={[styles.card, styles.emptyCard, { backgroundColor: colors.card }]}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>{emptyText}</Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {sorted.map((event, idx) => (
              <TimelineRow
                key={event.id}
                event={event}
                isLast={idx === sorted.length - 1}
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

// ─── Row ──────────────────────────────────────────────────────────────────────

function TimelineRow({
  event,
  isLast,
  colors,
  onLongPress,
}: {
  event: DailyEvent;
  isLast: boolean;
  colors: typeof Colors.light;
  onLongPress?: () => void;
}) {
  const accent = EventColors[event.type as EventType];
  const detail = getEventDetail(event);

  return (
    <Pressable
      style={styles.row}
      onLongPress={onLongPress}
      delayLongPress={400}
      android_ripple={onLongPress ? { color: accent + '22', borderless: false } : null}>
      {/* ── Left gutter: line + dot ── */}
      <View style={styles.gutter}>
        {!isLast && (
          <View style={[styles.line, { backgroundColor: colors.border }]} />
        )}
        <View style={[styles.dot, { backgroundColor: accent, borderColor: colors.card }]} />
      </View>

      {/* ── Content ── */}
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
        <Text style={[styles.time, { color: colors.muted }]}>
          {format(new Date(event.occurred_at), 'h:mm a')}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    // starts just below the dot (dot sits at marginTop=18, height=12 → bottom edge at 30)
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
