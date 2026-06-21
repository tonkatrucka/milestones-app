import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { Colors, Fonts, MemoryColor, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useActiveChild } from '@/hooks/use-active-child';
import { useAppStore } from '@/store/app-store';
import { useMemories } from '@/hooks/use-memories';
import { MemoryCard } from '@/components/memories/MemoryCard';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Memory } from '@/lib/database.types';

interface MemorySection {
  title: string;
  monthKey: string;
  data: Memory[];
}

function groupByMonth(memories: Memory[]): MemorySection[] {
  const map = new Map<string, MemorySection>();

  for (const memory of memories) {
    const date = parseISO(memory.occurred_at);
    const monthKey = format(date, 'yyyy-MM');
    if (!map.has(monthKey)) {
      map.set(monthKey, {
        monthKey,
        title: format(date, 'MMMM yyyy'),
        data: [],
      });
    }
    map.get(monthKey)!.data.push(memory);
  }

  return Array.from(map.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

export default function MemoriesScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const { session } = useAuth();
  const { activeChild } = useActiveChild(session?.user.id ?? null);
  const activeChildId = useAppStore((s) => s.activeChildId);

  const { memories, isLoading, refresh } = useMemories(activeChildId);
  const sections = useMemo(() => groupByMonth(memories), [memories]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.headerCard, { backgroundColor: colors.card }]}>
        <View style={styles.headerLeft}>
          <Text
            style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {activeChild ? `${activeChild.name}'s Memories` : 'Memories'}
          </Text>
          {memories.length > 0 ? (
            <View style={[styles.countPill, { backgroundColor: MemoryColor + '22' }]}>
              <Text style={[styles.countText, { color: MemoryColor }]}>{memories.length}</Text>
            </View>
          ) : null}
        </View>
        <Pressable
          style={[styles.addBadge, { backgroundColor: MemoryColor }]}
          onPress={() => router.push('/memory/new' as any)}>
          <Text style={styles.addBadgeText}>+ Add</Text>
        </Pressable>
      </View>

      {isLoading && memories.length === 0 ? (
        <View style={[styles.flex, styles.center]}>
          <ActivityIndicator color={MemoryColor} />
        </View>
      ) : memories.length === 0 ? (
        <EmptyState
          emoji="📸"
          title="No memories yet"
          subtitle={
            activeChild
              ? `Capture special moments for ${activeChild.name} — trips, birthdays, funny days, and more.`
              : 'Add a child to start collecting memories.'
          }
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + Spacing.md }]}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={MemoryColor} />
          }
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>
                {section.title}
              </Text>
              <View style={[styles.sectionLine, { backgroundColor: MemoryColor + '44' }]} />
            </View>
          )}
          renderItem={({ item }) => (
            <MemoryCard
              memory={item}
              variant="featured"
              onPress={() => router.push(`/memory/${item.id}` as any)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.lg,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    flexShrink: 1,
  },
  countPill: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    fontWeight: '800',
  },
  addBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
  },
  addBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  list: {
    paddingHorizontal: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  sectionLine: {
    flex: 1,
    height: 2,
    borderRadius: 1,
  },
});
