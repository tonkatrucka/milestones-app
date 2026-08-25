import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useSafeBottomTabBarHeight } from '@/hooks/use-safe-tab-bar-height';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Colors, EventColors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  EVENT_EMOJIS,
  EVENT_LABELS,
  getEventDetail,
} from '@/lib/event-display';
import type { WeekDay, WeekPointItem, WeekSleepSegment } from '@/lib/week-timeline';
import { weekHasEvents } from '@/lib/week-timeline';
import type { DailyEvent, EventType } from '@/lib/database.types';

const HOURS_PER_DAY = 24;
const MIN_CHART_HEIGHT = 320;
const DEFAULT_CHART_HEIGHT = 480;
const MINUTES_PER_DAY = 1440;
const GUTTER_W = 44;
const MARKER_SIZE = 24;
const MARKER_HOVER_SCALE = 1.38;
const MARKER_HIT_RADIUS = 22;
const TIMELINE_WIDTH = 3;
const HOUR_TICKS = Array.from({ length: HOURS_PER_DAY }, (_, hour) => hour);

const OVERLAP_OFFSETS = [-12, -6, 0, 6, 12] as const;

export interface ActivitiesWeekViewProps {
  weekDays: WeekDay[];
  isLoading: boolean;
  onRefresh: () => void;
  onEventLongPress?: (event: DailyEvent) => void;
}

interface TooltipState {
  item: WeekPointItem;
  pageX: number;
  pageY: number;
  width: number;
  height: number;
}

export function ActivitiesWeekView({
  weekDays,
  isLoading,
  onRefresh,
  onEventLongPress,
}: ActivitiesWeekViewProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const tabBarHeight = useSafeBottomTabBarHeight();
  const hasEvents = weekHasEvents(weekDays);

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0);

  const chartHeight =
    containerHeight > 0
      ? Math.max(
          MIN_CHART_HEIGHT,
          containerHeight - stickyHeaderHeight - Spacing.sm * 2,
        )
      : DEFAULT_CHART_HEIGHT;
  const hourHeight = chartHeight / HOURS_PER_DAY;

  const openTooltipForItem = useCallback(
    (item: WeekPointItem, pageX: number, pageY: number, width: number, height: number) => {
      setTooltip({
        item,
        pageX,
        pageY,
        width,
        height,
      });
    },
    [],
  );

  const handleContainerLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerHeight(event.nativeEvent.layout.height);
  }, []);

  const handleStickyHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    setStickyHeaderHeight(event.nativeEvent.layout.height);
  }, []);

  return (
    <View style={styles.flex} onLayout={handleContainerLayout}>
      <WeekDayHeader weekDays={weekDays} colors={colors} onLayout={handleStickyHeaderLayout} />

      <ScrollView
        style={styles.flex}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.lg }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.primary} />
        }>
        <View style={styles.chartWrapper}>
          <View style={styles.chartRow}>
            <View style={[styles.hourGutter, { height: chartHeight }]}>
              {HOUR_TICKS.map((hour) => (
                <Text
                  key={hour}
                  style={[
                    styles.hourLabel,
                    {
                      color: colors.muted,
                      top: hour * hourHeight + hourHeight / 2 - 6,
                    },
                  ]}>
                  {formatHourLabel(hour)}
                </Text>
              ))}
            </View>

            <View style={[styles.chartBody, { height: chartHeight }]}>
              <HourGrid colors={colors} chartHeight={chartHeight} hourHeight={hourHeight} />

              {weekDays.map((day) => (
                <DayColumn
                  key={day.dateKey}
                  day={day}
                  colors={colors}
                  chartHeight={chartHeight}
                  hoveredId={hoveredId}
                  onPointPress={openTooltipForItem}
                  onPointHoverChange={setHoveredId}
                  onEventLongPress={onEventLongPress}
                />
              ))}
            </View>
          </View>
        </View>

        <Legend colors={colors} />

        {!hasEvents && !isLoading && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No activities this week</Text>
            <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
              Log daily events from Home or the Assistant.
            </Text>
          </View>
        )}
      </ScrollView>

      {tooltip && (
        <PointTooltip
          item={tooltip.item}
          position={tooltip}
          colors={colors}
          onDismiss={() => setTooltip(null)}
        />
      )}
    </View>
  );
}

function WeekDayHeader({
  weekDays,
  colors,
  onLayout,
}: {
  weekDays: WeekDay[];
  colors: typeof Colors.light;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  return (
    <View
      onLayout={onLayout}
      style={[
        styles.stickyHeader,
        { backgroundColor: colors.background, borderBottomColor: colors.border },
      ]}>
      <View style={[styles.chartWrapper, styles.stickyHeaderInner]}>
        <View style={[styles.headerRow, styles.stickyHeaderRow]}>
          <View style={styles.gutterSpacer} />
          {weekDays.map((day) => (
            <View key={day.dateKey} style={styles.dayHeader}>
              <Text
                style={[
                  styles.dayShort,
                  { color: day.isToday ? colors.primary : colors.text },
                  day.isToday && styles.dayShortToday,
                ]}>
                {day.isToday ? 'Today' : day.shortLabel}
              </Text>
              <Text style={[styles.dayDate, { color: colors.muted }]}>{day.dateLabel}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

function HourGrid({
  colors,
  chartHeight,
  hourHeight,
}: {
  colors: typeof Colors.light;
  chartHeight: number;
  hourHeight: number;
}) {
  const lineColor = colors.border + '99';

  return (
    <View style={styles.hourGrid} pointerEvents="none">
      {HOUR_TICKS.map((hour) => (
        <DottedHourLine key={hour} top={hour * hourHeight} color={lineColor} />
      ))}
      <DottedHourLine top={chartHeight} color={lineColor} />
    </View>
  );
}

function DottedHourLine({ top, color }: { top: number; color: string }) {
  if (Platform.OS === 'ios') {
    return (
      <View
        style={[
          styles.hourGridLineDashed,
          {
            top,
            borderTopColor: color,
          },
        ]}
      />
    );
  }

  return (
    <View style={[styles.hourGridLineRow, { top }]}>
      {Array.from({ length: 18 }).map((_, index) => (
        <View
          key={index}
          style={[styles.hourGridDot, { backgroundColor: color }]}
        />
      ))}
    </View>
  );
}

function DayColumn({
  day,
  colors,
  chartHeight,
  hoveredId,
  onPointPress,
  onPointHoverChange,
  onEventLongPress,
}: {
  day: WeekDay;
  colors: typeof Colors.light;
  chartHeight: number;
  hoveredId: string | null;
  onPointPress: (
    item: WeekPointItem,
    pageX: number,
    pageY: number,
    width: number,
    height: number,
  ) => void;
  onPointHoverChange: (id: string | null) => void;
  onEventLongPress?: (event: DailyEvent) => void;
}) {
  return (
    <View style={[styles.dayColumn, { height: chartHeight }]}>
      <View style={styles.timelineLine} />

      {day.items.map((item) =>
        item.kind === 'sleepSegment' ? (
          <SleepBar key={item.id} segment={item} chartHeight={chartHeight} />
        ) : (
          (() => {
            const event = item.event;
            return (
              <PointMarker
                key={item.id}
                item={item}
                colors={colors}
                chartHeight={chartHeight}
                hovered={hoveredId === item.id}
                onPress={onPointPress}
                onHoverChange={onPointHoverChange}
                onLongPress={
                  event && onEventLongPress ? () => onEventLongPress(event) : undefined
                }
              />
            );
          })()
        ),
      )}
    </View>
  );
}

function SleepBar({
  segment,
  chartHeight,
}: {
  segment: WeekSleepSegment;
  chartHeight: number;
}) {
  const top = (segment.startMinutes / MINUTES_PER_DAY) * chartHeight;
  const height = Math.max(
    4,
    ((segment.endMinutes - segment.startMinutes) / MINUTES_PER_DAY) * chartHeight,
  );
  const color = EventColors.sleep;

  return (
    <View
      style={[
        styles.sleepBar,
        {
          top,
          height,
          backgroundColor: color + '66',
          borderColor: color,
        },
      ]}
      pointerEvents="none"
    />
  );
}

function PointMarker({
  item,
  colors,
  chartHeight,
  hovered,
  onPress,
  onHoverChange,
  onLongPress,
}: {
  item: WeekPointItem;
  colors: typeof Colors.light;
  chartHeight: number;
  hovered: boolean;
  onPress: (
    item: WeekPointItem,
    pageX: number,
    pageY: number,
    width: number,
    height: number,
  ) => void;
  onHoverChange: (id: string | null) => void;
  onLongPress?: () => void;
}) {
  const scale = useSharedValue(1);
  const markerRef = useRef<View>(null);
  const top = (item.minutes / MINUTES_PER_DAY) * chartHeight - MARKER_SIZE / 2;
  const offsetX = OVERLAP_OFFSETS[item.overlapIndex] ?? 0;
  const accent =
    item.type === 'wakeUp' ? EventColors.sleep : EventColors[item.type as EventType];
  const emoji = getPointEmoji(item);

  useEffect(() => {
    scale.value = withSpring(hovered ? MARKER_HOVER_SCALE : 1, {
      damping: 16,
      stiffness: 280,
    });
  }, [hovered, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.markerWrap,
        animatedStyle,
        {
          top,
          marginLeft: offsetX,
          zIndex: hovered ? 12 : 2 + item.overlapIndex,
        },
      ]}>
      <Pressable
        ref={markerRef}
        style={[
          styles.marker,
          {
            backgroundColor: colors.card,
            borderColor: accent,
          },
          styles.markerShadow,
        ]}
        onPress={() => {
          markerRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
            onPress(item, pageX, pageY, width, height);
          });
        }}
        onPressIn={() => onHoverChange(item.id)}
        onPressOut={() => onHoverChange(null)}
        onLongPress={onLongPress}
        delayLongPress={400}
        hitSlop={MARKER_HIT_RADIUS}>
        <Text style={styles.markerEmoji}>{emoji}</Text>
      </Pressable>
    </Animated.View>
  );
}

function getPointEmoji(item: WeekPointItem): string {
  if (item.type === 'wakeUp') return '☀️';
  return EVENT_EMOJIS[item.type as EventType];
}

function PointTooltip({
  item,
  position,
  colors,
  onDismiss,
}: {
  item: WeekPointItem;
  position: TooltipState;
  colors: typeof Colors.light;
  onDismiss: () => void;
}) {
  const { width: SW, height: SH } = Dimensions.get('window');
  const CARD_W = Math.min(SW - 48, 280);
  const accent =
    item.type === 'wakeUp' ? EventColors.sleep : EventColors[item.type as EventType];
  const label =
    item.type === 'wakeUp' ? 'Woke up' : EVENT_LABELS[item.type as EventType];
  const detail = item.event ? getEventDetail(item.event) : '';
  const time = format(parseISO(item.occurredAt), 'h:mm a');
  const chipMidY = position.pageY + position.height / 2;
  const showAbove = chipMidY > SH * 0.45;
  const left = Math.min(
    Math.max(16, position.pageX + position.width / 2 - CARD_W / 2),
    SW - CARD_W - 16,
  );
  const cardPosition = showAbove
    ? { bottom: SH - position.pageY + 8, left }
    : { top: position.pageY + position.height + 8, left };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss}>
        <Pressable
          style={[
            styles.tooltipCard,
            { backgroundColor: colors.card, width: CARD_W, ...cardPosition },
          ]}
          onPress={() => {}}>
          <View style={[styles.tooltipHeader, { borderBottomColor: colors.border }]}>
            <Text style={styles.tooltipEmoji}>{getPointEmoji(item)}</Text>
            <Text style={[styles.tooltipTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>
              {label}
            </Text>
            <Pressable onPress={onDismiss} hitSlop={8}>
              <Ionicons name="close" size={16} color={colors.muted} />
            </Pressable>
          </View>
          <View style={styles.tooltipBody}>
            <Text style={[styles.tooltipTime, { color: accent }]}>{time}</Text>
            {detail ? (
              <Text style={[styles.tooltipDetail, { color: colors.text }]}>{detail}</Text>
            ) : null}
            {item.event?.notes ? (
              <Text style={[styles.tooltipNotes, { color: colors.muted }]} numberOfLines={3}>
                {item.event.notes}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Legend({ colors }: { colors: typeof Colors.light }) {
  const items: { type: EventType; label: string }[] = [
    { type: 'nappy', label: 'Nappy' },
    { type: 'meal', label: 'Meal' },
    { type: 'sleep', label: 'Sleep' },
  ];

  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <View key={item.type} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: EventColors[item.type] }]} />
          <Text style={[styles.legendLabel, { color: colors.muted }]}>{item.label}</Text>
        </View>
      ))}
      <View style={styles.legendItem}>
        <Text style={styles.legendEmoji}>☀️</Text>
        <Text style={[styles.legendLabel, { color: colors.muted }]}>Wake up</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stickyHeader: {
    zIndex: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stickyHeaderInner: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  stickyHeaderRow: {
    marginBottom: 0,
  },
  chartWrapper: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  gutterSpacer: {
    width: GUTTER_W,
  },
  dayHeader: {
    flex: 1,
    alignItems: 'center',
  },
  dayShort: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Fonts!.rounded,
  },
  dayShortToday: {
    fontWeight: '800',
  },
  dayDate: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  chartRow: {
    flexDirection: 'row',
  },
  hourGutter: {
    width: GUTTER_W,
    position: 'relative',
  },
  hourLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'right',
    paddingRight: 5,
  },
  chartBody: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  hourGrid: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
  },
  hourGridLineDashed: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dotted',
    opacity: 0.75,
  },
  hourGridLineRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 1,
    overflow: 'hidden',
  },
  hourGridDot: {
    width: 3,
    height: 1,
    borderRadius: 1,
    opacity: 0.75,
  },
  dayColumn: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    zIndex: 1,
  },
  timelineLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: TIMELINE_WIDTH,
    backgroundColor: '#000',
    borderRadius: 1,
    zIndex: 1,
  },
  sleepBar: {
    position: 'absolute',
    width: 10,
    borderRadius: 4,
    borderWidth: 1,
    zIndex: 2,
  },
  markerWrap: {
    position: 'absolute',
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerShadow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 3,
    },
    android: {
      elevation: 4,
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 3,
    },
  }),
  markerEmoji: {
    fontSize: 12,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendEmoji: {
    fontSize: 10,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  tooltipCard: {
    position: 'absolute',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingBottom: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.xs,
  },
  tooltipEmoji: {
    fontSize: 16,
  },
  tooltipTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  tooltipBody: {
    gap: 4,
  },
  tooltipTime: {
    fontSize: 14,
    fontWeight: '700',
  },
  tooltipDetail: {
    fontSize: 13,
    fontWeight: '600',
  },
  tooltipNotes: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: Fonts!.rounded,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
