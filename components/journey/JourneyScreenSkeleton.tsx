import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Skeleton } from '@/components/shared/Skeleton';

function TimelineRowSkeleton() {
  return (
    <View style={styles.timelineRow}>
      <Skeleton width={36} height={14} borderRadius={4} />
      <View style={styles.timelineMarker}>
        <Skeleton width={12} height={12} borderRadius={Radius.full} />
        <Skeleton width={2} height={72} borderRadius={1} style={styles.timelineLine} />
      </View>
      <View style={styles.timelineCard}>
        <Skeleton width="55%" height={16} />
        <Skeleton width="90%" height={12} style={styles.gapSm} />
        <Skeleton width="70%" height={12} />
      </View>
    </View>
  );
}

export function JourneyScreenSkeleton() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.headerCard, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
        <Skeleton width="62%" height={24} borderRadius={Radius.md} />
        <View style={styles.headerActions}>
          <Skeleton width={88} height={30} borderRadius={Radius.full} />
          <Skeleton width={88} height={30} borderRadius={Radius.full} />
        </View>
      </View>

      <View style={styles.filterRow}>
        <Skeleton width={56} height={32} borderRadius={Radius.full} />
        <Skeleton width={88} height={32} borderRadius={Radius.full} />
        <Skeleton width={88} height={32} borderRadius={Radius.full} />
        <Skeleton width={72} height={32} borderRadius={Radius.full} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + Spacing.md }]}
        showsVerticalScrollIndicator={false}>
        <Skeleton width={120} height={18} borderRadius={Radius.sm} style={styles.monthLabel} />
        <TimelineRowSkeleton />
        <TimelineRowSkeleton />
        <TimelineRowSkeleton />
        <Skeleton width={100} height={18} borderRadius={Radius.sm} style={styles.monthLabel} />
        <TimelineRowSkeleton />
        <TimelineRowSkeleton />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
    gap: Spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexShrink: 0,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  scroll: {
    paddingHorizontal: Spacing.md,
  },
  monthLabel: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  timelineMarker: {
    alignItems: 'center',
    width: 24,
  },
  timelineLine: {
    marginTop: Spacing.xs,
  },
  timelineCard: {
    flex: 1,
    gap: Spacing.xs,
  },
  gapSm: {
    marginTop: Spacing.xs,
  },
});
