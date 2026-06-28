import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useActiveChild } from '@/hooks/use-active-child';
import { useInsights } from '@/hooks/use-insights';
import { ObservationSection } from '@/components/insights/ObservationSection';
import { ResearchBullets } from '@/components/insights/ResearchBullets';

export default function InsightsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const tabBarHeight = useBottomTabBarHeight();
  const { session } = useAuth();
  const { activeChild } = useActiveChild(session?.user.id ?? null);
  const { data, isLoading, error, refresh } = useInsights(activeChild);

  if (!activeChild) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={styles.centred}>
          <Text style={styles.emptyEmoji}>💡</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No child selected</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading && !data) {
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
          {activeChild.name}'s Insights
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Updates once a day
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + Spacing.md }]}
        refreshControl={
          <RefreshControl refreshing={isLoading && !!data} onRefresh={refresh} tintColor={colors.primary} />
        }>
        {error && (
          <Text style={[styles.error, { color: '#c0392b' }]}>{error}</Text>
        )}

        <ObservationSection
          shortInsights={data?.shortInsights ?? []}
          longInsights={data?.longInsights ?? []}
        />

        <ResearchBullets bullets={data?.researchBullets ?? []} />
      </ScrollView>
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
  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  scroll: {
    paddingHorizontal: Spacing.md,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  error: {
    marginBottom: Spacing.sm,
    fontSize: 14,
  },
});
