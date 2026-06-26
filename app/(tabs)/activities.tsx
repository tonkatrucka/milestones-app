import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useActiveChild } from '@/hooks/use-active-child';
import { useMemberRole } from '@/hooks/use-member-role';
import { useActivitiesTimeline } from '@/hooks/use-activities-timeline';
import { useAppStore } from '@/store/app-store';
import { ActivitiesTimeline } from '@/components/journey/ActivitiesTimeline';
import { EditEventModal } from '@/components/events/EditEventModal';
import type { DailyEvent } from '@/lib/database.types';

export default function ActivitiesScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const { session } = useAuth();
  const { activeChild } = useActiveChild(session?.user.id ?? null);
  const activeChildId = useAppStore((s) => s.activeChildId);
  const { canWrite } = useMemberRole(activeChildId, session?.user.id ?? null);

  const { sections, isLoading, refresh } = useActivitiesTimeline(
    activeChildId,
    activeChild?.date_of_birth ?? null,
  );

  const [editingEvent, setEditingEvent] = useState<DailyEvent | null>(null);

  if (!activeChild) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={styles.centred}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No child selected</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading && sections.length === 0) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, styles.centred, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text
          style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}
          numberOfLines={1}
          adjustsFontSizeToFit>
          {activeChild.name}'s Activities
        </Text>
      </View>

      <ActivitiesTimeline
        sections={sections}
        isLoading={isLoading}
        onRefresh={refresh}
        onEventLongPress={canWrite ? setEditingEvent : undefined}
      />

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
  centred: { alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
});
