import { useCallback, useState } from 'react';
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
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useActiveChild } from '@/hooks/use-active-child';
import { useAppStore } from '@/store/app-store';
import { useDailyEvents } from '@/hooks/use-daily-events';
import { QuickLogCard } from '@/components/home/QuickLogCard';
import { TodayFeed } from '@/components/home/TodayFeed';
import { EmptyState } from '@/components/shared/EmptyState';
import { EditEventModal } from '@/components/events/EditEventModal';
import { logEvent, updateEvent } from '@/services/events';
import type { DailyEvent, EventType } from '@/lib/database.types';
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

  const { todayEvents, yesterdayEvents, lastEvents, isLoading, refresh, addEvent } = useDailyEvents(activeChildId);

  // Re-fetch every time this screen comes into focus so times update after
  // returning from the log screen or switching back from another tab.
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const [showChildPicker, setShowChildPicker] = useState(false);
  const [editingEvent, setEditingEvent] = useState<DailyEvent | null>(null);

  const handleLog = useCallback(
    async (type: EventType, metadata: Record<string, unknown>, occurredAt?: Date) => {
      if (!activeChildId || !session?.user.id) return;
      try {
        const event = await logEvent({
          childId: activeChildId,
          type,
          metadata,
          userId: session.user.id,
          occurredAt,
        });
        addEvent(event);
      } catch {
        // Silently fail — tooltip already closed
      }
    },
    [activeChildId, session, addEvent],
  );

  const handleSleepWakeUp = useCallback(async (endAt: Date, startAt?: Date) => {
    const openSleep = lastEvents.sleep;
    if (!openSleep) return;
    const meta = openSleep.metadata as Record<string, unknown>;
    if (meta?.sleepEnd) return;
    try {
      await updateEvent(openSleep.id, {
        metadata: { ...meta, sleepEnd: endAt.toISOString() },
        ...(startAt ? { occurred_at: startAt.toISOString() } : {}),
      });
      refresh();
    } catch { /* ignore */ }
  }, [lastEvents, refresh]);

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
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: tabBarHeight + Spacing.md }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.primary} />
        }>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => setShowChildPicker((v) => !v)}>
            <Text
              style={[styles.childName, { color: colors.text, fontFamily: Fonts!.rounded }]}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {activeChild.name}'s Recent Activity
            </Text>
            <Text style={[styles.childAge, { color: colors.muted }]}>
              {formatAge(activeChild.date_of_birth)}
            </Text>
          </Pressable>
        </View>

        {/* Child picker */}
        {showChildPicker && children.length > 1 && (
          <View style={[styles.pickerRow, { backgroundColor: colors.card }]}>
            {children.map((c) => (
              <Pressable
                key={c.id}
                style={[
                  styles.pickerChip,
                  c.id === activeChildId && { backgroundColor: colors.primary },
                ]}
                onPress={() => {
                  setActiveChildId(c.id);
                  setShowChildPicker(false);
                }}>
                <Text
                  style={[
                    styles.pickerChipText,
                    { color: c.id === activeChildId ? '#fff' : colors.text },
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
              lastEvent={lastEvents[type]}
              onLog={(metadata, occurredAt) => handleLog(type, metadata, occurredAt)}
              onSleepWakeUp={(endAt, startAt) => handleSleepWakeUp(endAt, startAt)}
              onViewDetail={() => router.push(`/log/${type}` as any)}
            />
          ))}
        </View>

        {/* Today's feed */}
        <TodayFeed
          events={todayEvents}
          onEventLongPress={setEditingEvent}
        />

        {/* Yesterday's feed — collapsed by default */}
        <TodayFeed
          events={yesterdayEvents}
          title="Yesterday's activity"
          emptyText="No events logged yesterday"
          collapsible
          defaultCollapsed
          onEventLongPress={setEditingEvent}
        />
      </ScrollView>

      <EditEventModal
        event={editingEvent}
        visible={editingEvent !== null}
        onClose={() => setEditingEvent(null)}
        onSaved={() => { setEditingEvent(null); refresh(); }}
        onDeleted={() => { setEditingEvent(null); refresh(); }}
      />
    </SafeAreaView>
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
  },
  pickerChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#88888822',
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
