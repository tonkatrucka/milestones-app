import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, differenceInMonths, differenceInYears } from 'date-fns';
import { Colors, Fonts, MilestoneColors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useActiveChild } from '@/hooks/use-active-child';
import { getMilestone, deleteMilestone } from '@/services/milestones';
import { CATEGORY_EMOJIS, CATEGORY_LABELS } from '@/constants/milestone-templates';
import type { Milestone, MilestoneCategory } from '@/lib/database.types';

function formatChildAge(dob: string, achievedAt: string): string {
  const birth = new Date(dob);
  const achieved = new Date(achievedAt);
  const months = differenceInMonths(achieved, birth);
  const years = differenceInYears(achieved, birth);
  if (years === 0) return `${months} months old`;
  const rem = months - years * 12;
  if (rem === 0) return `${years} year${years > 1 ? 's' : ''} old`;
  return `${years}yr ${rem}mo`;
}

export default function MilestoneDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const { session } = useAuth();
  const { activeChild } = useActiveChild();

  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    if (!id) return;
    getMilestone(id).then((m) => {
      setMilestone(m);
      setIsLoading(false);
    });
  }, [id]);

  const handleDelete = () => {
    Alert.alert('Delete milestone', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          await deleteMilestone(id);
          router.back();
        },
      },
    ]);
  };

  const handleShare = () => {
    if (!milestone) return;
    router.push({ pathname: '/share/card' as any, params: { milestoneId: id } });
  };

  if (isLoading) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!milestone) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Milestone not found</Text>
      </View>
    );
  }

  const accent = MilestoneColors[milestone.category as MilestoneCategory];
  const ageLabel = activeChild ? formatChildAge(activeChild.date_of_birth, milestone.achieved_at) : null;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Media carousel */}
        {milestone.media_urls.length > 0 ? (
          <View>
            <Image
              source={{ uri: milestone.media_urls[activePhoto] }}
              style={styles.heroImage}
              contentFit="cover"
            />
            {milestone.media_urls.length > 1 && (
              <View style={styles.thumbRow}>
                {milestone.media_urls.map((url, i) => (
                  <Pressable key={i} onPress={() => setActivePhoto(i)}>
                    <Image
                      source={{ uri: url }}
                      style={[
                        styles.thumb,
                        i === activePhoto && { borderWidth: 2, borderColor: accent },
                      ]}
                      contentFit="cover"
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.heroPlaceholder, { backgroundColor: accent + '22' }]}>
            <Text style={styles.heroEmoji}>{CATEGORY_EMOJIS[milestone.category as MilestoneCategory]}</Text>
          </View>
        )}

        <View style={styles.content}>
          <View style={[styles.chip, { backgroundColor: accent + '22' }]}>
            <Text style={[styles.chipText, { color: accent }]}>
              {CATEGORY_EMOJIS[milestone.category as MilestoneCategory]} {CATEGORY_LABELS[milestone.category as MilestoneCategory]}
            </Text>
          </View>

          <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            {milestone.title}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[styles.metaDate, { color: colors.muted }]}>
              {format(new Date(milestone.achieved_at), 'EEEE, d MMMM yyyy')}
            </Text>
            {ageLabel && (
              <View style={[styles.ageBadge, { backgroundColor: accent }]}>
                <Text style={styles.ageText}>{ageLabel}</Text>
              </View>
            )}
          </View>

          {milestone.description ? (
            <Text style={[styles.description, { color: colors.text }]}>
              {milestone.description}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Action bar */}
      <View style={[styles.actionBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: accent }]}
          onPress={handleShare}>
          <Text style={styles.actionButtonText}>Share ✨</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButtonOutline, { borderColor: colors.danger }]}
          onPress={handleDelete}>
          <Text style={[styles.actionButtonOutlineText, { color: colors.danger }]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  heroImage: {
    width: '100%',
    height: 300,
  },
  heroPlaceholder: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 72 },
  thumbRow: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: Radius.sm,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  chip: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  metaDate: {
    fontSize: 14,
  },
  ageBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  ageText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  description: {
    fontSize: 16,
    lineHeight: 26,
  },
  actionBar: {
    flexDirection: 'row',
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionButton: {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  actionButtonOutline: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonOutlineText: {
    fontWeight: '700',
    fontSize: 16,
  },
});
