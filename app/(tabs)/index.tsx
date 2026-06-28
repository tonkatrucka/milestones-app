import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { ChildAvatar } from '@/components/children/ChildAvatar';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useActiveChild } from '@/hooks/use-active-child';
import { useMemberRole } from '@/hooks/use-member-role';
import { useAppStore } from '@/store/app-store';
import { useDailyEvents } from '@/hooks/use-daily-events';
import { QuickLogCard } from '@/components/home/QuickLogCard';
import { LogConfirmationOverlay } from '@/components/home/LogConfirmationOverlay';
import { TodayFeed } from '@/components/home/TodayFeed';
import { EmptyState } from '@/components/shared/EmptyState';
import { EditEventModal } from '@/components/events/EditEventModal';
import { AssistantFab, AssistantQuickSheet } from '@/components/home/AssistantQuickSheet';
import { logEvent, updateEvent } from '@/services/events';
import {
  startSleepTimer,
  stopSleepTimer,
  syncSleepTimerWithOpenEvent,
} from '@/services/sleep-timer';
import type { DailyEvent, EventType, SleepMetadata } from '@/lib/database.types';
import { useLogConfirmationStore } from '@/store/log-confirmation-store';
import { differenceInMonths, differenceInYears } from 'date-fns';

function formatAge(dob: string): string {
  const birth = new Date(dob);
  const now = new Date();
  const months = differenceInMonths(now, birth);
  const years = differenceInYears(now, birth);
  if (months < 1) return 'Newborn';
  if (years === 0) return `${months} months`;
  const rem = months - years * 12;
  if (rem === 0) return `${years} year${years > 1 ? 's' : ''}`;
  return `${years}yr ${rem}mo`;
}

export default function HomeScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const { session } = useAuth();
  const { activeChild, children, isChildrenLoading } = useActiveChild(session?.user.id ?? null);
  const setActiveChildId = useAppStore((s) => s.setActiveChildId);
  const activeChildId = useAppStore((s) => s.activeChildId);
  const { canWrite } = useMemberRole(activeChildId, session?.user.id ?? null);

  const { todayEvents, yesterdayEvents, lastEvents, isLoading, refresh, addEvent } = useDailyEvents(activeChildId);

  // Re-fetch every time this screen comes into focus so times update after
  // returning from the log screen or switching back from another tab.
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  useEffect(() => {
    const openSleep = lastEvents.sleep;
    const sleepMeta = openSleep?.metadata as SleepMetadata | undefined;
    const isOpen = openSleep && !sleepMeta?.sleepEnd;
    void syncSleepTimerWithOpenEvent(
      activeChildId,
      isOpen ? { id: openSleep.id, occurred_at: openSleep.occurred_at, metadata: sleepMeta ?? {} } : null,
    );
  }, [activeChildId, lastEvents.sleep]);

  const [showChildPicker, setShowChildPicker] = useState(false);
  const [editingEvent, setEditingEvent] = useState<DailyEvent | null>(null);
  const [showAssistant, setShowAssistant] = useState(false);
  const [highlightEventId, setHighlightEventId] = useState<string | null>(null);

  const feedRef = useRef<View>(null);
  const pending = useLogConfirmationStore((s) => s.pending);
  const confirmLog = useLogConfirmationStore((s) => s.confirmLog);
  const setTimelineTop = useLogConfirmationStore((s) => s.setTimelineTop);

  const measureTimelineTop = useCallback(() => {
    feedRef.current?.measureInWindow((x, y, width) => {
      setTimelineTop({ x, y, width, height: 1 });
    });
  }, [setTimelineTop]);

  useEffect(() => {
    if (!pending) return;
    addEvent(pending.event);
    setHighlightEventId(pending.event.id);
    measureTimelineTop();
    const timer = setTimeout(() => {
      setHighlightEventId((current) => (current === pending.event.id ? null : current));
    }, 1500);
    return () => clearTimeout(timer);
  }, [pending?.key, addEvent, measureTimelineTop]);

  const handleLog = useCallback(
    async (
      type: EventType,
      metadata: Record<string, unknown>,
      occurredAt?: Date,
      origin?: { x: number; y: number; width: number; height: number },
    ) => {
      if (!activeChildId || !session?.user.id) return;
      try {
        const event = await logEvent({
          childId: activeChildId,
          type,
          metadata,
          userId: session.user.id,
          occurredAt,
        });
        if (type === 'sleep') {
          await startSleepTimer(activeChildId, event.id, event.occurred_at);
        }
        confirmLog(event, origin);
      } catch {
        // Silently fail — tooltip already closed
      }
    },
    [activeChildId, session, confirmLog],
  );

  const handleSleepWakeUp = useCallback(async (
    endAt: Date,
    startAt?: Date,
    origin?: { x: number; y: number; width: number; height: number },
  ) => {
    const openSleep = lastEvents.sleep;
    if (!openSleep) return;
    const meta = openSleep.metadata as Record<string, unknown>;
    if (meta?.sleepEnd) return;
    try {
      const updated = await updateEvent(openSleep.id, {
        metadata: { ...meta, sleepEnd: endAt.toISOString() },
        ...(startAt ? { occurred_at: startAt.toISOString() } : {}),
      });
      await stopSleepTimer();
      confirmLog(updated, origin);
      refresh();
    } catch { /* ignore */ }
  }, [lastEvents, refresh, confirmLog]);

  const handleActivityLogged = useCallback(
    (events: DailyEvent[], origin?: { x: number; y: number; width: number; height: number }) => {
      events.forEach((event) => addEvent(event));
      if (events.length > 0) {
        confirmLog(events[events.length - 1], origin);
      }
      refresh();
    },
    [addEvent, confirmLog, refresh],
  );

  if (isChildrenLoading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!activeChild) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
        <EmptyState
          emoji="👶"
          title="Add your first child"
          subtitle="Tap below to get started tracking their journey."
        />
        <Pressable
          style={[styles.addChildButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/onboarding/add-child' as any)}>
          <Text style={styles.addChildButtonText}>Add a child</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: tabBarHeight + Spacing.md }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.primary} />
        }>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.headerRow}
            onPress={() => setShowChildPicker((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={`${activeChild.name}, ${formatAge(activeChild.date_of_birth)}. Switch child`}>
            <ChildAvatar
              avatarUrl={activeChild.avatar_url}
              size={56}
              accentColor={colors.primary}
            />
            <View style={styles.headerText}>
              <Text
                style={[styles.childName, { color: colors.text, fontFamily: Fonts!.rounded }]}
                numberOfLines={1}
                adjustsFontSizeToFit>
                {activeChild.name}'s Recent Activity
              </Text>
              <Text style={[styles.childAge, { color: colors.muted }]}>
                {formatAge(activeChild.date_of_birth)}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Child picker */}
        {showChildPicker && children.length > 1 && (
          <View style={[styles.pickerRow, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
            {children.map((c) => (
              <Pressable
                key={c.id}
                style={[
                  styles.pickerChip,
                  { backgroundColor: colors.surface },
                  c.id === activeChildId && { backgroundColor: colors.primary },
                ]}
                onPress={() => {
                  setActiveChildId(c.id);
                  setShowChildPicker(false);
                }}>
                <ChildAvatar
                  avatarUrl={c.avatar_url}
                  size={28}
                  accentColor={c.id === activeChildId ? colors.onPrimary : colors.primary}
                />
                <Text
                  style={[
                    styles.pickerChipText,
                    { color: c.id === activeChildId ? colors.onPrimary : colors.text },
                  ]}>
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Quick log cards */}
        <View style={styles.cardsRow}>
          {(['nappy', 'meal', 'sleep'] as EventType[]).map((type) => (
            <QuickLogCard
              key={type}
              type={type}
              childId={activeChildId}
              lastEvent={lastEvents[type]}
              readOnly={!canWrite}
              onLog={(metadata, occurredAt, origin) => handleLog(type, metadata, occurredAt, origin)}
              onSleepWakeUp={(endAt, startAt, origin) => handleSleepWakeUp(endAt, startAt, origin)}
              onViewDetail={() => router.push(`/log/${type}` as never)}
            />
          ))}
        </View>

        <View ref={feedRef} onLayout={measureTimelineTop} collapsable={false}>
          <TodayFeed
            events={todayEvents}
            yesterdayEvents={yesterdayEvents}
            highlightEventId={highlightEventId ?? undefined}
            forceToday={!!highlightEventId}
            onEventLongPress={canWrite ? setEditingEvent : undefined}
          />
        </View>
      </ScrollView>

      <EditEventModal
        event={editingEvent}
        visible={editingEvent !== null}
        onClose={() => setEditingEvent(null)}
        onSaved={() => { setEditingEvent(null); refresh(); }}
        onDeleted={() => { setEditingEvent(null); refresh(); }}
      />
    </SafeAreaView>

      {!showAssistant && (
        <AssistantFab onPress={() => setShowAssistant(true)} />
      )}

      <AssistantQuickSheet
        visible={showAssistant}
        onClose={() => setShowAssistant(false)}
        childId={activeChildId}
        childName={activeChild.name}
        childDob={activeChild.date_of_birth}
        canWrite={canWrite}
        onActivityLogged={handleActivityLogged}
      />

      <LogConfirmationOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  container: {
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  header: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  childName: {
    fontSize: 28,
    fontWeight: '800',
  },
  childAge: {
    fontSize: 14,
    marginTop: 2,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pickerChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  addChildButton: {
    margin: Spacing.lg,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  addChildButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
  },
});
