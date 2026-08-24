import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBottomTabBarHeight } from '@/hooks/use-safe-tab-bar-height';
import { useRouter } from 'expo-router';
import { differenceInMonths } from 'date-fns';
import { Colors, Fonts, MilestoneColors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useActiveChild } from '@/hooks/use-active-child';
import { useInsights } from '@/hooks/use-insights';
import { useNarratives } from '@/hooks/use-narratives';
import { ObservationSection } from '@/components/insights/ObservationSection';
import { InsightsScreenSkeleton } from '@/components/insights/InsightsScreenSkeleton';
import { ResearchBullets } from '@/components/insights/ResearchBullets';
import { NarrativeCard } from '@/components/shared/NarrativeCard';
import { AGE_BRACKETS, CATEGORY_EMOJIS, CATEGORY_LABELS } from '@/constants/milestone-templates';
import type { MilestoneCategory } from '@/lib/database.types';

function MilestoneSuggestions({
  ageMonths,
  colors,
  router,
}: {
  ageMonths: number;
  colors: typeof Colors.light;
  router: ReturnType<typeof useRouter>;
}) {
  const bracket = AGE_BRACKETS.find(
    (b) => ageMonths >= b.minMonths && ageMonths < b.maxMonths,
  );
  if (!bracket) return null;

  // Show up to 2 categories with 1 suggestion each
  const categories: MilestoneCategory[] = ['development', 'language', 'movement'];
  const suggestions = categories
    .flatMap((cat) => bracket.suggestions[cat].slice(0, 1).map((s) => ({ ...s, cat })))
    .slice(0, 2);

  if (suggestions.length === 0) return null;

  return (
    <View style={[suggestStyles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[suggestStyles.label, { color: colors.muted }]}>WATCH FOR AT THIS AGE</Text>
      {suggestions.map((s, i) => (
        <Pressable
          key={i}
          style={[suggestStyles.row, i < suggestions.length - 1 && { borderBottomWidth: 1, borderColor: colors.border }]}
          onPress={() => router.push(`/milestone/new?title=${encodeURIComponent(s.title)}&category=${s.cat}` as never)}>
          <Text style={suggestStyles.emoji}>{s.emoji}</Text>
          <View style={suggestStyles.info}>
            <Text style={[suggestStyles.title, { color: colors.text }]}>{s.title}</Text>
            <Text style={[suggestStyles.cat, { color: MilestoneColors[s.cat] }]}>
              {CATEGORY_EMOJIS[s.cat]} {CATEGORY_LABELS[s.cat]}
            </Text>
          </View>
          <Text style={[suggestStyles.logText, { color: colors.primary }]}>Log</Text>
        </Pressable>
      ))}
    </View>
  );
}

const suggestStyles = StyleSheet.create({
  container: { borderRadius: Radius.lg, borderWidth: 1, marginBottom: Spacing.md, overflow: 'hidden' },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, padding: Spacing.md, paddingBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  emoji: { fontSize: 24 },
  info: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600' },
  cat: { fontSize: 11, marginTop: 2 },
  logText: { fontSize: 13, fontWeight: '700' },
});

export default function InsightsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const tabBarHeight = useSafeBottomTabBarHeight();
  const router = useRouter();
  const { session } = useAuth();
  const { activeChild, isBootstrapping } = useActiveChild(session?.user.id ?? null);
  const { data, isLoading, error, refresh } = useInsights(activeChild);
  const narratives = useNarratives(activeChild?.id ?? null, activeChild?.name ?? null);

  const ageMonths = activeChild
    ? differenceInMonths(new Date(), new Date(activeChild.date_of_birth))
    : null;

  if (isBootstrapping || (isLoading && !data)) {
    return <InsightsScreenSkeleton />;
  }

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

  const weeklyNarrative = narratives.weekly;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text
          style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}
          numberOfLines={1}
          adjustsFontSizeToFit>
          {activeChild.name}&apos;s Insights
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Updates once a day
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + Spacing.md }]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && !!data}
            onRefresh={() => { refresh(); void narratives.refresh(); }}
            tintColor={colors.primary}
          />
        }>
        {error && (
          <Text style={[styles.error, { color: '#c0392b' }]}>{error}</Text>
        )}

        <NarrativeCard
          label="THIS WEEK"
          text={weeklyNarrative}
          emptyHint={`Log a few feeds, naps, or nappies this week and ${activeChild.name}'s story will appear here.`}
          colors={colors}
          onGenerate={narratives.generateWeekly}
          isGenerating={narratives.isGeneratingWeekly}
          generateLabel="Write this week's story"
        />

        <ObservationSection
          shortInsights={data?.shortInsights ?? []}
          longInsights={data?.longInsights ?? []}
        />

        {ageMonths !== null && ageMonths <= 48 && (
          <>
            <MilestoneSuggestions ageMonths={ageMonths} colors={colors} router={router} />
            <Pressable
              style={[suggestStyles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/checklist' as never)}
              accessibilityRole="button"
              accessibilityLabel="Open developmental checklist">
              <Text style={[suggestStyles.label, { color: colors.muted }]}>WELL-CHILD CHECKLIST</Text>
              <View style={[suggestStyles.row, { paddingBottom: Spacing.md }]}>
                <Text style={suggestStyles.emoji}>🌱</Text>
                <View style={suggestStyles.info}>
                  <Text style={[suggestStyles.title, { color: colors.text }]}>CDC signs for this age</Text>
                  <Text style={[suggestStyles.cat, { color: colors.muted }]}>
                    Record Yes, Not yet, or Not sure
                  </Text>
                </View>
                <Text style={[suggestStyles.logText, { color: colors.primary }]}>Open</Text>
              </View>
            </Pressable>
          </>
        )}

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
