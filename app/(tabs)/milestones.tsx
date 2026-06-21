import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { FlatList } from 'react-native';
import { Colors, Fonts, MilestoneColors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useActiveChild } from '@/hooks/use-active-child';
import { useAppStore } from '@/store/app-store';
import { useMilestones } from '@/hooks/use-milestones';
import { MilestoneCard } from '@/components/milestones/MilestoneCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { CATEGORY_LABELS, CATEGORY_EMOJIS } from '@/constants/milestone-templates';
import type { MilestoneCategory } from '@/lib/database.types';

const CATEGORIES: Array<MilestoneCategory | 'all'> = ['all', 'language', 'movement', 'development'];

export default function MilestonesScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const { session } = useAuth();
  const { activeChild } = useActiveChild(session?.user.id ?? null);
  const activeChildId = useAppStore((s) => s.activeChildId);

  const { milestones, isLoading, refresh } = useMilestones(activeChildId);
  const [activeCategory, setActiveCategory] = useState<MilestoneCategory | 'all'>('all');

  const filtered = activeCategory === 'all'
    ? milestones
    : milestones.filter((m) => m.category === activeCategory);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Header card — same card+radius treatment as Journey section headers */}
      <View style={[styles.headerCard, { backgroundColor: colors.card }]}>
        <View style={styles.headerLeft}>
          <Text
            style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {activeChild ? `${activeChild.name}'s Milestones` : 'Milestones'}
          </Text>
        </View>
        <Pressable
          style={[styles.addBadge, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/milestone/new' as any)}>
          <Text style={styles.addBadgeText}>+ Add</Text>
        </Pressable>
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}>
        {CATEGORIES.map((cat) => {
          const isActive = cat === activeCategory;
          const accent = cat === 'all' ? colors.primary : MilestoneColors[cat as MilestoneCategory];
          return (
            <Pressable
              key={cat}
              style={[
                styles.filterChip,
                { backgroundColor: isActive ? accent : accent + '22' },
              ]}
              onPress={() => setActiveCategory(cat)}>
              <Text style={[styles.filterChipText, { color: isActive ? '#fff' : accent }]}>
                {cat === 'all' ? '✨ All' : `${CATEGORY_EMOJIS[cat as MilestoneCategory]} ${CATEGORY_LABELS[cat as MilestoneCategory]}`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <View style={[styles.flex, styles.center]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          emoji="⭐"
          title="No milestones yet"
          subtitle={activeCategory === 'all'
            ? `Tap "+ Add" to record ${activeChild?.name ?? 'your child'}'s first milestone.`
            : `No ${CATEGORY_LABELS[activeCategory as MilestoneCategory]} milestones yet.`}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + Spacing.md }]}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <MilestoneCard
              milestone={item}
              childDob={activeChild?.date_of_birth}
              onPress={() => router.push(`/milestone/${item.id}` as any)}
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
  },
  agePill: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  ageLabel: {
    fontSize: 11,
    fontWeight: '700',
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
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterRow: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  list: {
    padding: Spacing.md,
  },
});
