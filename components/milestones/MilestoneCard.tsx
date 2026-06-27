import { Pressable, StyleSheet, Text, View } from 'react-native';
import { format, differenceInMonths, differenceInYears } from 'date-fns';
import { ResolvedImage } from '@/components/media/ResolvedImage';
import { Colors, MilestoneColors, Fonts, Radius, Spacing } from '@/constants/theme';
import { CATEGORY_EMOJIS, CATEGORY_LABELS } from '@/constants/milestone-templates';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Milestone } from '@/lib/database.types';
import type { MilestoneCategory } from '@/lib/database.types';

function formatChildAge(dob: string, achievedAt: string): string {
  const birth = new Date(dob);
  const achieved = new Date(achievedAt);
  const years = differenceInYears(achieved, birth);
  const months = differenceInMonths(achieved, birth) % 12;

  if (years === 0) return `${differenceInMonths(achieved, birth)} months`;
  if (months === 0) return `${years}yr`;
  return `${years}yr ${months}mo`;
}

interface MilestoneCardProps {
  milestone: Milestone;
  childDob?: string;
  onPress: () => void;
}

export function MilestoneCard({ milestone, childDob, onPress }: MilestoneCardProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const accent = MilestoneColors[milestone.category as MilestoneCategory];
  const firstPhoto = milestone.media_urls[0];

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={onPress}
      android_ripple={{ color: accent + '22' }}>
      {firstPhoto ? (
        <ResolvedImage stored={firstPhoto} style={styles.thumbnail} contentFit="cover" />
      ) : (
        <View style={[styles.thumbnailPlaceholder, { backgroundColor: accent + '22' }]}>
          <Text style={styles.categoryEmoji}>
            {CATEGORY_EMOJIS[milestone.category as MilestoneCategory]}
          </Text>
        </View>
      )}
      <View style={styles.info}>
        <View style={styles.topRow}>
          <View style={[styles.chip, { backgroundColor: accent + '22' }]}>
            <Text style={[styles.chipText, { color: accent }]}>
              {CATEGORY_LABELS[milestone.category as MilestoneCategory]}
            </Text>
          </View>
          {childDob ? (
            <Text style={[styles.age, { color: colors.muted }]}>
              {formatChildAge(childDob, milestone.achieved_at)}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]} numberOfLines={2}>
          {milestone.title}
        </Text>
        <Text style={[styles.date, { color: colors.muted }]}>
          {format(new Date(milestone.achieved_at), 'dd MMM yyyy')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  thumbnail: {
    width: 90,
    height: 90,
  },
  thumbnailPlaceholder: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEmoji: {
    fontSize: 32,
  },
  info: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  chip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  age: {
    fontSize: 11,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
  },
});
