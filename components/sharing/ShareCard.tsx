import { StyleSheet, Text, View } from 'react-native';
import { format, differenceInMonths, differenceInYears } from 'date-fns';
import { ResolvedImage } from '@/components/media/ResolvedImage';
import { MilestoneColors, Fonts, MemoryColor, Spacing, Radius } from '@/constants/theme';
import {
  PaletteNeutralsCool,
  PaletteNeutralsWarm,
} from '@/constants/reference-palette';
import { CATEGORY_EMOJIS, CATEGORY_LABELS } from '@/constants/milestone-templates';
import type { Milestone, Memory, Child, MilestoneCategory } from '@/lib/database.types';

function formatChildAge(dob: string, achievedAt: string): string {
  const birth = new Date(dob);
  const achieved = new Date(achievedAt);
  const months = differenceInMonths(achieved, birth);
  const years = differenceInYears(achieved, birth);
  if (years === 0) return `${months} months old`;
  const rem = months - years * 12;
  if (rem === 0) return `${years} year${years > 1 ? 's' : ''} old`;
  return `${years} year${years > 1 ? 's' : ''} and ${rem} month${rem > 1 ? 's' : ''} old`;
}

interface ShareCardProps {
  child: Child;
  milestone?: Milestone | null;
  memory?: Memory | null;
}

export function ShareCard({ milestone, memory, child }: ShareCardProps) {
  const isMemory = !!memory && !milestone;
  const accent = isMemory
    ? MemoryColor
    : MilestoneColors[(milestone?.category ?? 'development') as MilestoneCategory];
  const firstPhoto = (isMemory ? memory?.media_urls : milestone?.media_urls)?.[0];
  const title = isMemory ? memory!.title : milestone!.title;
  const description = isMemory ? memory?.description : milestone?.description;
  const dateIso = isMemory ? memory!.occurred_at : milestone!.achieved_at;
  const ageLabel = formatChildAge(child.date_of_birth, dateIso);
  const headerEmoji = isMemory
    ? '📸'
    : CATEGORY_EMOJIS[(milestone?.category ?? 'development') as MilestoneCategory];
  const headerCategory = isMemory
    ? 'Memory'
    : CATEGORY_LABELS[(milestone?.category ?? 'development') as MilestoneCategory];

  return (
    <View style={[styles.card, { borderColor: accent }]}>
      <View style={[styles.header, { backgroundColor: accent }]}>
        <Text style={styles.headerEmoji}>
          {headerEmoji}
        </Text>
        <View>
          <Text style={styles.headerCategory}>
            {headerCategory}
          </Text>
          <Text style={styles.headerApp}>Milestones</Text>
        </View>
      </View>
      {firstPhoto ? (
        <ResolvedImage stored={firstPhoto} style={styles.photo} contentFit="cover" />
      ) : null}
      <View style={styles.body}>
        <Text style={[styles.title, { fontFamily: Fonts!.rounded, color: PaletteNeutralsCool.charcoal }]}>
          {title}
        </Text>
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
        <View style={styles.footer}>
          <Text style={[styles.childName, { color: accent, fontFamily: Fonts!.rounded }]}>{child.name}</Text>
          <Text style={styles.ageDate}>
            {ageLabel} · {format(new Date(dateIso), 'dd MMM yyyy')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 340,
    backgroundColor: PaletteNeutralsWarm.warmCream,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 3,
    elevation: 8,
    shadowColor: PaletteNeutralsCool.charcoal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  headerEmoji: {
    fontSize: 32,
  },
  headerCategory: {
    color: PaletteNeutralsWarm.warmCream,
    fontWeight: '700',
    fontSize: 16,
  },
  headerApp: {
    color: PaletteNeutralsWarm.warmCream + '99',
    fontSize: 12,
  },
  photo: {
    width: '100%',
    height: 220,
  },
  body: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  description: {
    fontSize: 15,
    color: PaletteNeutralsCool.slate,
    lineHeight: 22,
  },
  footer: {
    marginTop: Spacing.sm,
    gap: 2,
  },
  childName: {
    fontSize: 16,
    fontWeight: '700',
  },
  ageDate: {
    fontSize: 13,
    color: PaletteNeutralsCool.stoneGrey,
  },
});
