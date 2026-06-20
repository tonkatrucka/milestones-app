import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { format, differenceInMonths, differenceInYears } from 'date-fns';
import { MilestoneColors, Fonts, Spacing, Radius } from '@/constants/theme';
import { CATEGORY_EMOJIS, CATEGORY_LABELS } from '@/constants/milestone-templates';
import type { Milestone, Child, MilestoneCategory } from '@/lib/database.types';

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
  milestone: Milestone;
  child: Child;
}

export function ShareCard({ milestone, child }: ShareCardProps) {
  const accent = MilestoneColors[milestone.category as MilestoneCategory];
  const firstPhoto = milestone.media_urls[0];
  const ageLabel = formatChildAge(child.date_of_birth, milestone.achieved_at);

  return (
    <View style={[styles.card, { borderColor: accent }]}>
      <View style={[styles.header, { backgroundColor: accent }]}>
        <Text style={styles.headerEmoji}>
          {CATEGORY_EMOJIS[milestone.category as MilestoneCategory]}
        </Text>
        <View>
          <Text style={styles.headerCategory}>
            {CATEGORY_LABELS[milestone.category as MilestoneCategory]}
          </Text>
          <Text style={styles.headerApp}>Milestones</Text>
        </View>
      </View>
      {firstPhoto ? (
        <Image source={{ uri: firstPhoto }} style={styles.photo} contentFit="cover" />
      ) : null}
      <View style={styles.body}>
        <Text style={[styles.title, { fontFamily: Fonts!.rounded, color: '#1C1C1E' }]}>
          {milestone.title}
        </Text>
        {milestone.description ? (
          <Text style={styles.description}>{milestone.description}</Text>
        ) : null}
        <View style={styles.footer}>
          <Text style={[styles.childName, { color: accent, fontFamily: Fonts!.rounded }]}>{child.name}</Text>
          <Text style={styles.ageDate}>
            {ageLabel} · {format(new Date(milestone.achieved_at), 'dd MMM yyyy')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 340,
    backgroundColor: '#FFFAF5',
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 3,
    elevation: 8,
    shadowColor: '#000',
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
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  headerApp: {
    color: '#ffffff99',
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
    color: '#555',
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
    color: '#888',
  },
});
