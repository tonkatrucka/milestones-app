import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Colors, Fonts, MemoryColor, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useActiveChild } from '@/hooks/use-active-child';
import { useMemberRole } from '@/hooks/use-member-role';
import { useJourneyTimeline } from '@/hooks/use-journey-timeline';
import { useAppStore } from '@/store/app-store';
import { JourneyTimeline } from '@/components/journey/JourneyTimeline';
import { deleteMemory } from '@/services/memories';
import { deleteMilestone } from '@/services/milestones';
import type { Memory, Milestone } from '@/lib/database.types';

export default function JourneyScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const { session } = useAuth();
  const { activeChild } = useActiveChild(session?.user.id ?? null);
  const activeChildId = useAppStore((s) => s.activeChildId);
  const { canWrite } = useMemberRole(activeChildId, session?.user.id ?? null);

  const { sections, isLoading, refresh } = useJourneyTimeline(
    activeChildId,
    activeChild?.date_of_birth ?? null,
  );

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleMilestoneDelete = useCallback(
    (milestone: Milestone) => {
      Alert.alert('Delete milestone', 'Are you sure? This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteMilestone(milestone.id);
            refresh();
          },
        },
      ]);
    },
    [refresh],
  );

  const handleMemoryDelete = useCallback(
    (memory: Memory) => {
      Alert.alert('Delete memory', 'Are you sure? This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteMemory(memory.id);
            refresh();
          },
        },
      ]);
    },
    [refresh],
  );

  if (!activeChild) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={styles.centred}>
          <Text style={styles.emptyEmoji}>🗺️</Text>
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
      <View style={[styles.headerCard, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Text
            style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {activeChild.name}'s Journey
          </Text>
        </View>
        {canWrite && (
          <View style={styles.addRow}>
            <Pressable
              style={[styles.addBadge, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/milestone/new' as never)}>
              <Text style={styles.addBadgeText}>+ Milestone</Text>
            </Pressable>
            <Pressable
              style={[styles.addBadge, { backgroundColor: MemoryColor }]}
              onPress={() => router.push('/memory/new' as never)}>
              <Text style={styles.addBadgeText}>+ Memory</Text>
            </Pressable>
          </View>
        )}
      </View>

      <JourneyTimeline
        sections={sections}
        isLoading={isLoading}
        childDob={activeChild.date_of_birth}
        canWrite={canWrite}
        onRefresh={refresh}
        onMilestonePress={(milestone: Milestone) =>
          router.push(`/milestone/${milestone.id}` as never)
        }
        onMemoryPress={(memory: Memory) =>
          router.push(`/memory/${memory.id}` as never)
        }
        onMilestoneDelete={handleMilestoneDelete}
        onMemoryDelete={handleMemoryDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centred: { alignItems: 'center', justifyContent: 'center' },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    gap: Spacing.sm,
  },
  headerLeft: { flex: 1 },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  addRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexShrink: 0,
  },
  addBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 1,
  },
  addBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
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
