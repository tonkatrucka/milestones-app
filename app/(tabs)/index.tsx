import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
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
import { VoiceLogSheet } from '@/components/home/VoiceLogSheet';
import { NapPredictionCard } from '@/components/home/NapPredictionCard';
import { WellbeingPrompt } from '@/components/home/WellbeingPrompt';
import { HandoffSummarySheet } from '@/components/home/HandoffSummarySheet';
import { logEvent, updateEvent, getRecentEvents } from '@/services/events';
import {
  startSleepTimer,
  stopSleepTimer,
  syncSleepTimerWithOpenEvent,
} from '@/services/sleep-timer';
import { ensureLocalChannel } from '@/services/local-notifications';
import { getTodayCheckin } from '@/services/wellbeing';
import type { DailyEvent, EventType, SleepMetadata } from '@/lib/database.types';
import { useLogConfirmationStore } from '@/store/log-confirmation-store';
import { useSleepPrediction } from '@/hooks/use-sleep-prediction';
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
  const { activeChild, children, isBootstrapping } = useActiveChild(session?.user.id ?? null);
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
  const [showVoiceLog, setShowVoiceLog] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const [highlightEventId, setHighlightEventId] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<DailyEvent[]>([]);
  const [showWellbeing, setShowWellbeing] = useState(false);
  const [wellbeingDismissed, setWellbeingDismissed] = useState(false);
  const prediction = useSleepPrediction(recentEvents);

  const openAssistant = useCallback(() => {
    if (Platform.OS === 'android') {
      router.push('/assistant' as never);
      return;
    }
    setShowAssistant(true);
  }, [router]);

  // Fetch recent events for sleep predictions + handoff
  useEffect(() => {
    if (!activeChildId) return;
    getRecentEvents(activeChildId, 14)
      .then(setRecentEvents)
      .catch(() => null);
  }, [activeChildId, todayEvents]);

  // Check if parent should see the wellbeing prompt today
  useEffect(() => {
    if (!session?.user.id || !activeChildId || wellbeingDismissed) return;
    getTodayCheckin(session.user.id, activeChildId)
      .then((checkin) => { if (!checkin) setShowWellbeing(true); })
      .catch(() => null);
  }, [session?.user.id, activeChildId, wellbeingDismissed]);

  // Ensure local notification channel exists (Android)
  useEffect(() => { void ensureLocalChannel(); }, []);

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

  if (isBootstrapping) {
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
                {activeChild.name}&apos;s Recent Activity
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

        {/* Secondary quick actions */}
        {canWrite && (
          <View style={styles.secondaryRow}>
            {(['pump', 'temperature', 'medication'] as EventType[]).map((type) => (
              <Pressable
                key={type}
                style={[styles.secondaryChip, { backgroundColor: colors.elevated, borderColor: colors.border }]}
                onPress={() => router.push(`/log/${type}` as never)}>
                <Text style={styles.secondaryChipEmoji}>
                  {type === 'pump' ? '🤱' : type === 'temperature' ? '🌡️' : '💊'}
                </Text>
                <Text style={[styles.secondaryChipLabel, { color: colors.text }]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.secondaryChip, { backgroundColor: colors.elevated, borderColor: colors.border }]}
              onPress={() => setShowHandoff(true)}>
              <Text style={styles.secondaryChipEmoji}>🤝</Text>
              <Text style={[styles.secondaryChipLabel, { color: colors.text }]}>Handoff</Text>
            </Pressable>
          </View>
        )}

        {/* Nap prediction */}
        <NapPredictionCard prediction={prediction} />

        {/* Parent wellbeing */}
        {showWellbeing && !wellbeingDismissed && session?.user.id && activeChildId && (
          <WellbeingPrompt
            userId={session.user.id}
            childId={activeChildId}
            onCheckedIn={() => setShowWellbeing(false)}
            onDismiss={() => { setShowWellbeing(false); setWellbeingDismissed(true); }}
          />
        )}

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

      {!showAssistant && !showVoiceLog && (
        <View style={styles.fabRow}>
          <Pressable
            style={[styles.voiceFab, { backgroundColor: colors.elevated, borderColor: colors.border }]}
            onPress={() => setShowVoiceLog(true)}
            accessibilityLabel="Quick voice log">
            <Text style={styles.voiceFabEmoji}>🎙️</Text>
          </Pressable>
          <AssistantFab onPress={openAssistant} />
        </View>
      )}

      {Platform.OS !== 'android' && (
        <AssistantQuickSheet
          visible={showAssistant}
          onClose={() => setShowAssistant(false)}
          childId={activeChildId}
          childName={activeChild.name}
          childDob={activeChild.date_of_birth}
          canWrite={canWrite}
          onActivityLogged={handleActivityLogged}
        />
      )}

      <VoiceLogSheet
        visible={showVoiceLog}
        onClose={() => setShowVoiceLog(false)}
        childId={activeChildId}
        childName={activeChild.name}
        childDob={activeChild.date_of_birth}
        onActivityLogged={handleActivityLogged}
      />

      <HandoffSummarySheet
        visible={showHandoff}
        onClose={() => setShowHandoff(false)}
        events={[...todayEvents, ...yesterdayEvents]}
        childName={activeChild.name}
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
  secondaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  secondaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  secondaryChipEmoji: { fontSize: 14 },
  secondaryChipLabel: { fontSize: 13, fontWeight: '600' },
  fabRow: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    left: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingRight: Spacing.md,
    paddingBottom: Spacing.lg,
    pointerEvents: 'box-none',
  },
  voiceFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  voiceFabEmoji: { fontSize: 22 },
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
