import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { differenceInMinutes, format, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from "expo-router/js-tabs";

import { Colors, EventColors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ActivitiesMonthSection, EventDay } from '@/lib/timeline-sections';
import type {
  DailyEvent,
  EventType,
  MealMetadata,
  NappyMetadata,
  SleepMetadata,
} from '@/lib/database.types';

const SECTION_MAX_H = 4000;
const DAY_DETAIL_MAX_H = 800;

const EVENT_EMOJIS: Record<EventType, string> = {
  nappy: '🧷',
  meal: '🍼',
  sleep: '😴',
};

export interface ActivitiesTimelineProps {
  sections: ActivitiesMonthSection[];
  isLoading: boolean;
  onRefresh: () => void;
  onEventLongPress?: (event: DailyEvent) => void;
}

export function ActivitiesTimeline({
  sections,
  isLoading,
  onRefresh,
  onEventLongPress,
}: ActivitiesTimelineProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.lg }}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.primary} />
      }>
      {sections.map((section, idx) => (
        <CollapsibleSection
          key={section.monthKey}
          section={section}
          initiallyCollapsed={idx >= 2}
          onEventLongPress={onEventLongPress}
          colors={colors}
        />
      ))}

      {sections.length === 0 && !isLoading && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No activities yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Log daily events from Home or the Assistant.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function CollapsibleSection({
  section,
  initiallyCollapsed,
  onEventLongPress,
  colors,
}: {
  section: ActivitiesMonthSection;
  initiallyCollapsed: boolean;
  onEventLongPress?: (event: DailyEvent) => void;
  colors: typeof Colors.light;
}) {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const contentH = useSharedValue(initiallyCollapsed ? 0 : SECTION_MAX_H);
  const chevronRot = useSharedValue(initiallyCollapsed ? -90 : 0);

  const toggle = useCallback(() => {
    const next = !collapsed;
    setCollapsed(next);
    contentH.value = withTiming(next ? 0 : SECTION_MAX_H, {
      duration: 300,
      easing: Easing.out(Easing.quad),
    });
    chevronRot.value = withTiming(next ? -90 : 0, { duration: 300 });
  }, [collapsed, contentH, chevronRot]);

  const contentStyle = useAnimatedStyle(() => ({
    maxHeight: contentH.value,
    overflow: 'hidden',
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRot.value}deg` }],
  }));

  const visibleDays = section.eventDays.filter((d) => d.events.length > 0);
  if (visibleDays.length === 0) return null;

  const daysWithEvents = visibleDays;
  const daysCount = daysWithEvents.length;
  const fmtAvg = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));
  const avgNappy = daysCount > 0 ? daysWithEvents.reduce((s, d) => s + d.counts.nappy, 0) / daysCount : 0;
  const avgMl = daysCount > 0 ? daysWithEvents.reduce((s, d) => s + d.totalMl, 0) / daysCount : 0;
  const avgSleepH =
    daysCount > 0 ? daysWithEvents.reduce((s, d) => s + d.totalSleepMins, 0) / daysCount / 60 : 0;

  return (
    <View style={styles.sectionWrapper}>
      <Pressable
        style={[styles.sectionHeader, { backgroundColor: colors.card }]}
        onPress={toggle}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionMonth, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            {section.label}
          </Text>
          <Animated.View style={chevronStyle}>
            <Ionicons name="chevron-down" size={16} color={colors.muted} />
          </Animated.View>
          <View style={styles.sectionHeaderSpacer} />
          <View style={[styles.agePill, { backgroundColor: colors.primary + '18' }]}>
            <Text style={[styles.ageLabel, { color: colors.primary }]}>{section.ageLabel}</Text>
          </View>
        </View>

        <View style={styles.sectionBadgeRow}>
          {avgNappy > 0 && (
            <View style={[styles.countBadge, { backgroundColor: EventColors.nappy + '22' }]}>
              <Text style={[styles.countBadgeText, { color: EventColors.nappy }]} numberOfLines={1}>
                {`🧷 ${fmtAvg(avgNappy)}/\u2060day`}
              </Text>
            </View>
          )}
          {avgMl > 0 && (
            <View style={[styles.countBadge, { backgroundColor: EventColors.meal + '22' }]}>
              <Text style={[styles.countBadgeText, { color: EventColors.meal }]} numberOfLines={1}>
                {`🍼 ${Math.round(avgMl)}ml/\u2060day`}
              </Text>
            </View>
          )}
          {avgSleepH > 0 && (
            <View style={[styles.countBadge, { backgroundColor: EventColors.sleep + '22' }]}>
              <Text style={[styles.countBadgeText, { color: EventColors.sleep }]} numberOfLines={1}>
                {`😴 ${avgSleepH.toFixed(1)}h/\u2060day`}
              </Text>
            </View>
          )}
        </View>
      </Pressable>

      <Animated.View style={contentStyle}>
        <View style={[styles.sectionContent, { borderLeftColor: colors.border }]}>
          {visibleDays.map((day) => (
            <EventDayRow
              key={day.dateKey}
              day={day}
              colors={colors}
              onEventLongPress={onEventLongPress}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

interface TooltipState {
  type: EventType;
  pageX: number;
  pageY: number;
  width: number;
  height: number;
}

function EventDayRow({
  day,
  colors,
  onEventLongPress,
}: {
  day: EventDay;
  colors: typeof Colors.light;
  onEventLongPress?: (event: DailyEvent) => void;
}) {
  const hasDetailContent = day.events.length > 0 || day.wakeUps.length > 0;
  const [expanded, setExpanded] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const detailH = useSharedValue(0);

  const nappyRef = useRef<View>(null);
  const mealRef = useRef<View>(null);
  const sleepRef = useRef<View>(null);
  const mlRef = useRef<View>(null);
  const sleepStatRef = useRef<View>(null);

  const toggleDetail = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    detailH.value = withTiming(next ? DAY_DETAIL_MAX_H : 0, {
      duration: 250,
      easing: Easing.out(Easing.quad),
    });
  }, [expanded, detailH]);

  const detailStyle = useAnimatedStyle(() => ({
    maxHeight: detailH.value,
    overflow: 'hidden',
  }));

  const openTooltip = useCallback((type: EventType, ref: React.RefObject<View | null>) => {
    ref.current?.measure((_x, _y, width, height, pageX, pageY) => {
      setTooltip({ type, pageX, pageY, width, height });
    });
  }, []);

  const eventsByType = useMemo(
    () => ({
      nappy: day.events.filter((e) => e.type === 'nappy'),
      meal: day.events.filter((e) => e.type === 'meal'),
      sleep: day.events.filter((e) => e.type === 'sleep'),
    }),
    [day.events],
  );

  type DetailItem = { kind: 'event'; event: DailyEvent } | { kind: 'wakeup'; time: string };
  const detailItems = useMemo<DetailItem[]>(() => {
    const items: DetailItem[] = [
      ...day.events.map((e) => ({ kind: 'event' as const, event: e })),
      ...day.wakeUps.map((t) => ({ kind: 'wakeup' as const, time: t })),
    ];
    items.sort((a, b) => {
      const tA = a.kind === 'event' ? a.event.occurred_at : a.time;
      const tB = b.kind === 'event' ? b.event.occurred_at : b.time;
      return tA.localeCompare(tB);
    });
    return items;
  }, [day.events, day.wakeUps]);

  const sleepLabel =
    day.totalSleepMins >= 60
      ? `${Math.floor(day.totalSleepMins / 60)}h${day.totalSleepMins % 60 > 0 ? ` ${day.totalSleepMins % 60}m` : ''}`
      : `${day.totalSleepMins}m`;

  return (
    <View style={[styles.dayBlock, { borderTopColor: colors.border }]}>
      <Pressable style={styles.dayRow} onPress={toggleDetail} disabled={!hasDetailContent}>
        <Text style={[styles.dayLabel, { color: colors.text }]}>{day.label}</Text>

        <View style={styles.dayCountsRow}>
          {day.counts.nappy > 0 && (
            <Pressable
              ref={nappyRef}
              style={styles.dayCountChip}
              onPress={(e) => {
                e.stopPropagation();
                openTooltip('nappy', nappyRef);
              }}
              hitSlop={6}>
              <Text style={styles.dayCountEmoji}>{EVENT_EMOJIS.nappy}</Text>
              <Text style={[styles.dayCountNum, { color: colors.muted }]}>{day.counts.nappy}</Text>
            </Pressable>
          )}
          {day.counts.meal > 0 && (
            <Pressable
              ref={mealRef}
              style={styles.dayCountChip}
              onPress={(e) => {
                e.stopPropagation();
                openTooltip('meal', mealRef);
              }}
              hitSlop={6}>
              <Text style={styles.dayCountEmoji}>{EVENT_EMOJIS.meal}</Text>
              <Text style={[styles.dayCountNum, { color: colors.muted }]}>{day.counts.meal}</Text>
            </Pressable>
          )}
          {day.totalMl > 0 && (
            <Pressable
              ref={mlRef}
              style={[styles.statChip, { backgroundColor: EventColors.meal + '18' }]}
              onPress={(e) => {
                e.stopPropagation();
                openTooltip('meal', mlRef);
              }}
              hitSlop={6}>
              <Text style={[styles.statChipText, { color: EventColors.meal }]}>{day.totalMl}ml</Text>
            </Pressable>
          )}
          {day.counts.sleep > 0 && (
            <Pressable
              ref={sleepRef}
              style={styles.dayCountChip}
              onPress={(e) => {
                e.stopPropagation();
                openTooltip('sleep', sleepRef);
              }}
              hitSlop={6}>
              <Text style={styles.dayCountEmoji}>{EVENT_EMOJIS.sleep}</Text>
              <Text style={[styles.dayCountNum, { color: colors.muted }]}>{day.counts.sleep}</Text>
            </Pressable>
          )}
          {day.totalSleepMins > 0 && (
            <Pressable
              ref={sleepStatRef}
              style={[styles.statChip, { backgroundColor: EventColors.sleep + '18' }]}
              onPress={(e) => {
                e.stopPropagation();
                openTooltip('sleep', sleepStatRef);
              }}
              hitSlop={6}>
              <Text style={[styles.statChipText, { color: EventColors.sleep }]}>{sleepLabel}</Text>
            </Pressable>
          )}
        </View>

        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.muted}
          style={!hasDetailContent ? { opacity: 0.35 } : undefined}
        />
      </Pressable>

      <Animated.View style={detailStyle}>
        <View style={styles.dayDetails}>
          {detailItems.map((item) =>
            item.kind === 'event' ? (
              <EventDetailRow
                key={item.event.id}
                event={item.event}
                colors={colors}
                onLongPress={onEventLongPress ? () => onEventLongPress(item.event) : undefined}
              />
            ) : (
              <WakeUpRow key={`wake-${item.time}`} time={item.time} colors={colors} />
            ),
          )}
        </View>
      </Animated.View>

      {tooltip && (
        <EventTooltip
          type={tooltip.type}
          events={eventsByType[tooltip.type]}
          position={tooltip}
          onDismiss={() => setTooltip(null)}
          colors={colors}
        />
      )}
    </View>
  );
}

function formatEventDetail(event: DailyEvent): string {
  const meta = event.metadata as Record<string, unknown>;
  switch (event.type) {
    case 'nappy': {
      const m = meta as unknown as NappyMetadata;
      const map: Record<string, string> = {
        wet: '💧 Wet',
        dirty: '🧷 Dirty',
        both: '🧷 Both',
        dry: '✓ Dry',
      };
      return map[m?.nappyType] ?? 'Nappy change';
    }
    case 'meal': {
      const m = meta as unknown as MealMetadata;
      const typeMap: Record<string, string> = {
        breast: '🤱 Breastfed',
        bottle: '🍼 Bottle',
        solid: '🥣 Solids',
        snack: '🍪 Snack',
      };
      const base = typeMap[m?.mealType] ?? '🍼 Meal';
      if (m?.mealType === 'breast') {
        const parts: string[] = [];
        if (m.breastSide) parts.push(m.breastSide.charAt(0).toUpperCase() + m.breastSide.slice(1));
        if (m.durationMins != null) parts.push(`${m.durationMins}m`);
        else if (m.amountMl) parts.push(`${m.amountMl}ml`);
        return parts.length > 0 ? `${base} · ${parts.join(' · ')}` : base;
      }
      if (m?.amountMl) return `${base} · ${m.amountMl}ml`;
      if (m?.food) return `${base} · ${m.food}`;
      return base;
    }
    case 'sleep': {
      const m = meta as SleepMetadata;
      const fmtMins = (mins: number) => {
        if (mins >= 60) {
          const h = Math.floor(mins / 60);
          const rem = mins % 60;
          return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
        }
        return `${mins}m`;
      };
      if (m?.sleepEnd) {
        const mins = Math.max(0, differenceInMinutes(parseISO(m.sleepEnd), parseISO(event.occurred_at)));
        return `😴 ${fmtMins(mins)}`;
      }
      const todayKey = format(new Date(), 'yyyy-MM-dd');
      const startKey = format(parseISO(event.occurred_at), 'yyyy-MM-dd');
      if (startKey === todayKey) {
        const mins = differenceInMinutes(new Date(), parseISO(event.occurred_at));
        return mins > 0 ? `😴 ${fmtMins(mins)}` : '😴 Ongoing';
      }
      return '😴 —';
    }
    default:
      return event.type;
  }
}

function EventDetailRow({
  event,
  colors,
  onLongPress,
}: {
  event: DailyEvent;
  colors: typeof Colors.light;
  onLongPress?: () => void;
}) {
  const accent = EventColors[event.type as EventType];
  return (
    <View style={[styles.eventDetailRow, { borderLeftColor: accent }]}>
      <Text style={[styles.eventDetailTime, { color: colors.muted }]}>
        {format(parseISO(event.occurred_at), 'h:mm a')}
      </Text>
      <View style={styles.eventDetailBody}>
        <Text style={[styles.eventDetailLabel, { color: colors.text }]}>
          {formatEventDetail(event)}
        </Text>
        {event.notes ? (
          <Text style={[styles.eventDetailNotes, { color: colors.muted }]} numberOfLines={2}>
            {event.notes}
          </Text>
        ) : null}
      </View>
      {onLongPress && (
        <Pressable
          onPress={onLongPress}
          hitSlop={12}
          style={styles.eventDetailMenu}
          android_ripple={{ color: colors.border, borderless: true, radius: 16 }}>
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

function WakeUpRow({ time, colors }: { time: string; colors: typeof Colors.light }) {
  return (
    <View style={[styles.eventDetailRow, { borderLeftColor: EventColors.sleep }]}>
      <Text style={[styles.eventDetailTime, { color: colors.muted }]}>
        {format(parseISO(time), 'h:mm a')}
      </Text>
      <View style={styles.eventDetailBody}>
        <Text style={[styles.eventDetailLabel, { color: colors.text }]}>☀️ Woke up</Text>
      </View>
    </View>
  );
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  breast: '🤱 Breastfed',
  bottle: '🍼 Bottle',
  solid: '🥣 Solids',
  snack: '🍪 Snack',
};

const NAPPY_TYPE_LABELS: Record<string, string> = {
  wet: '💧 Wet',
  dirty: '🧷 Dirty',
  both: '🧷 Both',
  dry: '✓  Dry',
};

function EventTooltip({
  type,
  events,
  position,
  onDismiss,
  colors,
}: {
  type: EventType;
  events: DailyEvent[];
  position: TooltipState;
  onDismiss: () => void;
  colors: typeof Colors.light;
}) {
  const { width: SW, height: SH } = Dimensions.get('window');
  const CARD_W = Math.min(SW - 48, 296);
  const accent = EventColors[type];
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
            <View style={[styles.tooltipAccentDot, { backgroundColor: accent }]} />
            <Text style={[styles.tooltipTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>
              {type === 'nappy' ? 'Nappy breakdown' : type === 'meal' ? 'Meals' : 'Sleep sessions'}
            </Text>
            <Pressable onPress={onDismiss} hitSlop={8}>
              <Ionicons name="close" size={16} color={colors.muted} />
            </Pressable>
          </View>
          <View style={styles.tooltipBody}>
            {type === 'nappy' && <NappyTooltipBody events={events} colors={colors} />}
            {type === 'meal' && <MealTooltipBody events={events} colors={colors} />}
            {type === 'sleep' && <SleepTooltipBody events={events} colors={colors} />}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NappyTooltipBody({ events, colors }: { events: DailyEvent[]; colors: typeof Colors.light }) {
  const counts: Record<string, number> = {};
  for (const e of events) {
    const t = (e.metadata as NappyMetadata)?.nappyType ?? 'unknown';
    counts[t] = (counts[t] ?? 0) + 1;
  }
  const rows = Object.entries(NAPPY_TYPE_LABELS)
    .map(([key, label]) => ({ key, label, n: counts[key] ?? 0 }))
    .filter((r) => r.n > 0);
  if (rows.length === 0) {
    return <Text style={[styles.tooltipEmpty, { color: colors.muted }]}>No details available</Text>;
  }
  return (
    <>
      {rows.map((r) => (
        <View key={r.key} style={[styles.tooltipRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.tooltipRowLabel, { color: colors.text }]}>{r.label}</Text>
          <View style={[styles.tooltipCountBadge, { backgroundColor: EventColors.nappy + '20' }]}>
            <Text style={[styles.tooltipCountText, { color: EventColors.nappy }]}>× {r.n}</Text>
          </View>
        </View>
      ))}
      <View style={styles.tooltipTotalRow}>
        <Text style={[styles.tooltipTotalLabel, { color: colors.muted }]}>Total</Text>
        <Text style={[styles.tooltipTotalValue, { color: EventColors.nappy }]}>
          {events.length} change{events.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </>
  );
}

function MealTooltipBody({ events, colors }: { events: DailyEvent[]; colors: typeof Colors.light }) {
  if (events.length === 0) {
    return <Text style={[styles.tooltipEmpty, { color: colors.muted }]}>No meals recorded</Text>;
  }
  const totalMl = events.reduce((sum, e) => {
    const ml = (e.metadata as MealMetadata)?.amountMl;
    return sum + (typeof ml === 'number' ? ml : 0);
  }, 0);
  return (
    <>
      {events.map((e, idx) => {
        const meta = e.metadata as MealMetadata;
        const label = MEAL_TYPE_LABELS[meta?.mealType] ?? '🍼 Meal';
        const detail =
          meta?.mealType === 'breast'
            ? [
                meta.breastSide ? meta.breastSide.charAt(0).toUpperCase() + meta.breastSide.slice(1) : null,
                meta.durationMins != null ? `${meta.durationMins}m` : meta.amountMl ? `${meta.amountMl}ml` : null,
              ]
                .filter(Boolean)
                .join(' · ') || null
            : meta?.amountMl
              ? `${meta.amountMl}ml`
              : meta?.food
                ? meta.food
                : null;
        const isLast = idx === events.length - 1;
        return (
          <View
            key={e.id}
            style={[
              styles.tooltipRow,
              { borderBottomColor: colors.border },
              isLast && { borderBottomWidth: 0 },
            ]}>
            <Text style={[styles.tooltipRowTime, { color: colors.muted }]}>
              {format(parseISO(e.occurred_at), 'h:mm a')}
            </Text>
            <Text style={[styles.tooltipRowLabel, { color: colors.text, flex: 1 }]}>{label}</Text>
            {detail && (
              <View style={[styles.tooltipCountBadge, { backgroundColor: EventColors.meal + '20' }]}>
                <Text style={[styles.tooltipCountText, { color: EventColors.meal }]}>{detail}</Text>
              </View>
            )}
          </View>
        );
      })}
      {totalMl > 0 && (
        <View style={styles.tooltipTotalRow}>
          <Text style={[styles.tooltipTotalLabel, { color: colors.muted }]}>Total consumed</Text>
          <Text style={[styles.tooltipTotalValue, { color: EventColors.meal }]}>{totalMl}ml</Text>
        </View>
      )}
    </>
  );
}

function SleepTooltipBody({ events, colors }: { events: DailyEvent[]; colors: typeof Colors.light }) {
  if (events.length === 0) {
    return <Text style={[styles.tooltipEmpty, { color: colors.muted }]}>No sleep recorded</Text>;
  }
  let totalMins = 0;
  return (
    <>
      {events.map((e, idx) => {
        const meta = e.metadata as SleepMetadata;
        const startStr = format(parseISO(e.occurred_at), 'h:mm a');
        const isLast = idx === events.length - 1;
        const fmtDur = (mins: number) => {
          if (mins >= 60) {
            const h = Math.floor(mins / 60);
            const rem = mins % 60;
            return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
          }
          return `${mins}m`;
        };
        if (!meta?.sleepEnd) {
          const todayKey = format(new Date(), 'yyyy-MM-dd');
          const startKey = format(parseISO(e.occurred_at), 'yyyy-MM-dd');
          const isOngoing = startKey === todayKey;
          const elapsedMins = differenceInMinutes(new Date(), parseISO(e.occurred_at));
          return (
            <View
              key={e.id}
              style={[
                styles.tooltipRow,
                { borderBottomColor: colors.border },
                isLast && { borderBottomWidth: 0 },
              ]}>
              <Text style={[styles.tooltipRowTime, { color: colors.muted }]}>{startStr}</Text>
              {isOngoing && elapsedMins > 0 ? (
                <View style={[styles.tooltipCountBadge, { backgroundColor: EventColors.sleep + '20' }]}>
                  <Text style={[styles.tooltipCountText, { color: EventColors.sleep }]}>
                    {fmtDur(elapsedMins)}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.tooltipRowLabel, { color: colors.muted }]}>—</Text>
              )}
            </View>
          );
        }
        const endStr = format(parseISO(meta.sleepEnd), 'h:mm a');
        const mins = Math.max(0, differenceInMinutes(parseISO(meta.sleepEnd), parseISO(e.occurred_at)));
        totalMins += mins;
        const duration =
          mins >= 60
            ? `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ''}`
            : `${mins}m`;
        return (
          <View
            key={e.id}
            style={[
              styles.tooltipRow,
              { borderBottomColor: colors.border },
              isLast && { borderBottomWidth: 0 },
            ]}>
            <Text style={[styles.tooltipRowTime, { color: colors.muted }]}>
              {startStr} – {endStr}
            </Text>
            <View style={[styles.tooltipCountBadge, { backgroundColor: EventColors.sleep + '20' }]}>
              <Text style={[styles.tooltipCountText, { color: EventColors.sleep }]}>{duration}</Text>
            </View>
          </View>
        );
      })}
      {totalMins > 0 && (
        <View style={styles.tooltipTotalRow}>
          <Text style={[styles.tooltipTotalLabel, { color: colors.muted }]}>Total sleep</Text>
          <Text style={[styles.tooltipTotalValue, { color: EventColors.sleep }]}>
            {totalMins >= 60
              ? `${Math.floor(totalMins / 60)}h${totalMins % 60 > 0 ? ` ${totalMins % 60}m` : ''}`
              : `${totalMins}m`}
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  sectionWrapper: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  sectionHeader: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm + 2,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sectionHeaderSpacer: { flex: 1 },
  sectionBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  sectionMonth: { fontSize: 15, fontWeight: '700' },
  agePill: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  ageLabel: { fontSize: 11, fontWeight: '700' },
  countBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    flexShrink: 0,
  },
  countBadgeText: { fontSize: 11, fontWeight: '700', flexShrink: 0 },
  sectionContent: {
    borderLeftWidth: 2,
    marginLeft: Spacing.md,
    paddingLeft: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  dayBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  dayLabel: { fontSize: 13, fontWeight: '600', width: 88 },
  dayCountsRow: { flex: 1, flexDirection: 'row', gap: Spacing.sm },
  dayCountChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dayCountEmoji: { fontSize: 14 },
  dayCountNum: { fontSize: 12, fontWeight: '600' },
  statChip: {
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statChipText: { fontSize: 11, fontWeight: '700' },
  dayDetails: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  eventDetailRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderLeftWidth: 3,
    paddingLeft: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  eventDetailTime: { fontSize: 11, fontWeight: '500', width: 60, paddingTop: 2 },
  eventDetailBody: { flex: 1, gap: 2 },
  eventDetailLabel: { fontSize: 13, fontWeight: '500' },
  eventDetailNotes: { fontSize: 12, fontStyle: 'italic' },
  eventDetailMenu: { padding: 4, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  tooltipCard: {
    position: 'absolute',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tooltipAccentDot: { width: 8, height: 8, borderRadius: 4 },
  tooltipTitle: { flex: 1, fontSize: 14, fontWeight: '700' },
  tooltipBody: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  tooltipRowTime: { fontSize: 12, fontWeight: '500', width: 76 },
  tooltipRowLabel: { fontSize: 13, fontWeight: '500' },
  tooltipCountBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginLeft: 'auto',
  },
  tooltipCountText: { fontSize: 12, fontWeight: '700' },
  tooltipTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  tooltipTotalLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tooltipTotalValue: { fontSize: 13, fontWeight: '800' },
  tooltipEmpty: { fontSize: 13, paddingVertical: Spacing.sm, textAlign: 'center' },
});
