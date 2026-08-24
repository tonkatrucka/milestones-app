import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { differenceInMonths } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useAppStore } from '@/store/app-store';
import { useActiveChild } from '@/hooks/use-active-child';
import { useMemberRole } from '@/hooks/use-member-role';
import { useDevChecklist } from '@/hooks/use-dev-checklist';
import { useBottomInset } from '@/components/shared/KeyboardSafeScreen';
import {
  CHECKLIST_AREA_LABELS,
  type ChecklistArea,
  type DevCheckpoint,
} from '@/constants/milestone-templates';
import {
  CHECK_AGES,
  CHECKLIST_AREA_ORDER,
  checklistProgress,
  checkpointsForBand,
  currentCheckAge,
  formatCheckAgeLabel,
  isActEarly,
  type CheckAge,
} from '@/lib/dev-checklist';
import type { DevChecklistStatus } from '@/lib/database.types';

const STATUSES: { key: DevChecklistStatus; label: string }[] = [
  { key: 'yes', label: 'Yes' },
  { key: 'not_yet', label: 'Not yet' },
  { key: 'not_sure', label: 'Not sure' },
];

const AREA_EMOJI: Record<ChecklistArea, string> = {
  social: '💛',
  language: '💬',
  cognitive: '🧠',
  movement: '🏃',
};

export default function ChecklistScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const bottomInset = useBottomInset();
  const { session } = useAuth();
  const activeChildId = useAppStore((s) => s.activeChildId);
  const { activeChild } = useActiveChild(session?.user.id ?? null);
  const { canWrite } = useMemberRole(activeChildId, session?.user.id ?? null);
  const { entries, isLoading, refresh, setStatus } = useDevChecklist(activeChildId);

  const ageMonths = activeChild
    ? differenceInMonths(new Date(), new Date(activeChild.date_of_birth))
    : 0;
  const defaultBand = currentCheckAge(ageMonths);
  const [bandOverride, setBandOverride] = useState<CheckAge | null>(null);
  const band = bandOverride ?? defaultBand;

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const checkpoints = useMemo(() => checkpointsForBand(band), [band]);
  const statusById = useMemo(() => {
    const map: Record<string, DevChecklistStatus> = {};
    for (const entry of entries) map[entry.checkpoint_id] = entry.status;
    return map;
  }, [entries]);
  const progress = checklistProgress(checkpoints, statusById);
  const actEarlyCount = checkpoints.filter((checkpoint) =>
    isActEarly(checkpoint, statusById[checkpoint.id], ageMonths),
  ).length;

  const grouped = CHECKLIST_AREA_ORDER.map((area) => ({
    area,
    items: checkpoints.filter((checkpoint) => checkpoint.area === area),
  })).filter((group) => group.items.length > 0);

  const handleStatus = async (checkpoint: DevCheckpoint, status: DevChecklistStatus) => {
    if (!canWrite) return;
    if (statusById[checkpoint.id] === status) return;
    try {
      await setStatus(checkpoint.id, status);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not save this check.');
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Spacing.xl + bottomInset }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            Developmental checklist
          </Text>
        </View>

        <Text style={[styles.lede, { color: colors.muted }]}>
          CDC well-child signs for {activeChild?.name ?? 'your child'}. This is a parent record, not a diagnosis.
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.ageRow}>
          {CHECK_AGES.map((age) => {
            const selected = age === band;
            const reached = ageMonths >= age;
            return (
              <Pressable
                key={age}
                onPress={() => setBandOverride(age)}
                style={[
                  styles.ageChip,
                  {
                    backgroundColor: selected ? colors.primary : colors.card,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}>
                <Text style={[styles.ageChipText, { color: selected ? '#fff' : colors.text }]}>
                  {formatCheckAgeLabel(age)}
                </Text>
                {!reached && !selected ? (
                  <Text style={[styles.ageHint, { color: colors.muted }]}>soon</Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.progressLabel, { color: colors.muted }]}>
            {formatCheckAgeLabel(band)} visit
          </Text>
          <Text style={[styles.progressValue, { color: colors.text }]}>
            {progress.observed} of {progress.total} observed
          </Text>
          {actEarlyCount > 0 ? (
            <Text style={[styles.actEarlySummary, { color: colors.danger }]}>
              {actEarlyCount === 1
                ? '1 sign is past the “act early” age — mention it at your next visit.'
                : `${actEarlyCount} signs are past the “act early” age — mention them at your next visit.`}
            </Text>
          ) : null}
        </View>

        {isLoading && entries.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          grouped.map((group) => (
            <View key={group.area} style={styles.group}>
              <Text style={[styles.groupLabel, { color: colors.muted }]}>
                {AREA_EMOJI[group.area]} {CHECKLIST_AREA_LABELS[group.area].toUpperCase()}
              </Text>
              {group.items.map((checkpoint) => (
                <CheckpointCard
                  key={checkpoint.id}
                  checkpoint={checkpoint}
                  status={statusById[checkpoint.id]}
                  actEarly={isActEarly(checkpoint, statusById[checkpoint.id], ageMonths)}
                  canWrite={canWrite}
                  colors={colors}
                  onSelect={(status) => void handleStatus(checkpoint, status)}
                />
              ))}
            </View>
          ))
        )}

        <Text style={[styles.disclaimer, { color: colors.muted }]}>
          Based on CDC Learn the Signs. Act Early (2022). If you are worried, talk to your health visitor or GP — do not wait for a scheduled check.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function CheckpointCard({
  checkpoint,
  status,
  actEarly,
  canWrite,
  colors,
  onSelect,
}: {
  checkpoint: DevCheckpoint;
  status?: DevChecklistStatus;
  actEarly: boolean;
  canWrite: boolean;
  colors: typeof Colors.light;
  onSelect: (status: DevChecklistStatus) => void;
}) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: actEarly ? colors.danger : colors.border,
        },
      ]}>
      <Text style={[styles.cardText, { color: colors.text }]}>{checkpoint.description}</Text>
      <View style={styles.statusRow}>
        {STATUSES.map((option) => {
          const selected = status === option.key;
          const selectedColor =
            option.key === 'yes' ? colors.primary : option.key === 'not_sure' ? '#C4856A' : colors.muted;
          return (
            <Pressable
              key={option.key}
              disabled={!canWrite}
              onPress={() => onSelect(option.key)}
              style={[
                styles.statusChip,
                {
                  borderColor: selected ? selectedColor : colors.border,
                  backgroundColor: selected ? selectedColor + '22' : colors.elevated,
                  opacity: canWrite ? 1 : 0.7,
                },
              ]}>
              <Text style={[styles.statusText, { color: selected ? selectedColor : colors.muted }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {actEarly ? (
        <Text style={[styles.actEarlyNote, { color: colors.danger }]}>
          Most children can do this by {checkpoint.actEarlyIfMissedBy} months. Mention it if it still isn’t happening.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: Spacing.md, gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.sm },
  title: { flex: 1, fontSize: 22, fontWeight: '800' },
  lede: { fontSize: 14, lineHeight: 20 },
  ageRow: { gap: Spacing.sm, paddingVertical: 2 },
  ageChip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  ageChipText: { fontSize: 14, fontWeight: '700' },
  ageHint: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  progressCard: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, gap: 4 },
  progressLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  progressValue: { fontSize: 18, fontWeight: '800' },
  actEarlySummary: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  loader: { marginTop: Spacing.xl },
  group: { gap: Spacing.sm },
  groupLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  card: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  cardText: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  statusRow: { flexDirection: 'row', gap: Spacing.sm },
  statusChip: {
    flex: 1,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  statusText: { fontSize: 13, fontWeight: '700' },
  actEarlyNote: { fontSize: 12, lineHeight: 17 },
  disclaimer: { fontSize: 12, lineHeight: 18, fontStyle: 'italic', marginTop: Spacing.sm },
});
