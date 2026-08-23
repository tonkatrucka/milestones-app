import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBottomTabBarHeight } from '@/hooks/use-safe-tab-bar-height';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Skeleton } from '@/components/shared/Skeleton';

function CardSkeleton({ lines }: { lines: number }) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  return (
    <View style={[styles.card, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
      <Skeleton width="42%" height={20} borderRadius={Radius.sm} />
      {Array.from({ length: lines }, (_, i) => (
        <View key={i} style={styles.bulletRow}>
          <Skeleton width={8} height={8} borderRadius={Radius.full} />
          <Skeleton
            width={i === lines - 1 ? '72%' : '92%'}
            height={14}
            style={styles.bulletLine}
          />
        </View>
      ))}
    </View>
  );
}

export function InsightsScreenSkeleton() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const tabBarHeight = useSafeBottomTabBarHeight();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Skeleton width="68%" height={28} borderRadius={Radius.md} />
        <Skeleton width="38%" height={14} borderRadius={Radius.sm} style={styles.subtitle} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + Spacing.md }]}
        showsVerticalScrollIndicator={false}>
        <CardSkeleton lines={4} />
        <CardSkeleton lines={3} />
        <View style={[styles.card, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
          <Skeleton width="36%" height={20} borderRadius={Radius.sm} />
          <Skeleton width={72} height={22} borderRadius={Radius.full} style={styles.tag} />
          <Skeleton width="96%" height={14} />
          <Skeleton width="88%" height={14} style={styles.gapSm} />
          <Skeleton width="64%" height={14} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  subtitle: {
    marginTop: Spacing.sm,
  },
  scroll: {
    paddingHorizontal: Spacing.md,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  bulletLine: {
    flex: 1,
  },
  tag: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  gapSm: {
    marginTop: Spacing.xs,
  },
});
