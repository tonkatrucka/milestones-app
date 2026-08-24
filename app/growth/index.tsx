import { useCallback } from 'react';
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
import { formatMediumDate } from '@/lib/calendar-date';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useAppStore } from '@/store/app-store';
import { useMemberRole } from '@/hooks/use-member-role';
import { useGrowth } from '@/hooks/use-growth';
import { GrowthChart } from '@/components/growth/GrowthChart';
import { deleteGrowthEntry } from '@/services/growth';

export default function GrowthScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const { session } = useAuth();
  const activeChildId = useAppStore((s) => s.activeChildId);
  const { canWrite } = useMemberRole(activeChildId, session?.user.id ?? null);
  const { entries, isLoading, refresh, removeEntry } = useGrowth(activeChildId);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleDelete = (id: string, dateLabel: string) => {
    Alert.alert(
      'Delete measurement',
      `Remove the measurement from ${dateLabel}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGrowthEntry(id);
              removeEntry(id);
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete');
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>Growth</Text>
          <View style={styles.headerActions}>
            {canWrite && (
              <Pressable
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/growth/add' as never)}>
                <Ionicons name="add" size={20} color="#fff" />
              </Pressable>
            )}
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <>
            {entries.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📏</Text>
              <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>
                Watch them grow
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                Weight, height, and head circumference — the numbers your paediatrician uses, always with you. Every measurement tells part of their story.
              </Text>
                {canWrite && (
                  <Pressable
                    style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                    onPress={() => router.push('/growth/add' as never)}>
                    <Text style={styles.emptyButtonText}>Add first measurement</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <>
                <View style={[styles.chartsCard, { backgroundColor: colors.card }]}>
                  <GrowthChart
                    entries={entries}
                    metric="weight_kg"
                    label="Weight"
                    unit="kg"
                    accentColor={colors.primary}
                  />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <GrowthChart
                    entries={entries}
                    metric="height_cm"
                    label="Height"
                    unit="cm"
                    accentColor={colors.secondary}
                  />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <GrowthChart
                    entries={entries}
                    metric="head_cm"
                    label="Head circumference"
                    unit="cm"
                    accentColor="#9C88D9"
                  />
                </View>

                <Text style={[styles.sectionLabel, { color: colors.muted }]}>MEASUREMENTS</Text>
                {entries.map((entry) => {
                    const dateLabel = formatMediumDate(entry.measured_at);
                  return (
                    <Pressable
                      key={entry.id}
                      style={[styles.entryRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onLongPress={() => canWrite && handleDelete(entry.id, dateLabel)}
                      accessibilityHint="Long press to delete">
                      <View style={styles.entryDate}>
                        <Text style={[styles.entryDateText, { color: colors.text, fontFamily: Fonts!.rounded }]}>
                          {dateLabel}
                        </Text>
                      </View>
                      <View style={styles.entryValues}>
                        {entry.weight_kg != null && (
                          <Text style={[styles.entryValue, { color: colors.text }]}>{entry.weight_kg}kg</Text>
                        )}
                        {entry.height_cm != null && (
                          <Text style={[styles.entryValue, { color: colors.text }]}>{entry.height_cm}cm</Text>
                        )}
                        {entry.head_cm != null && (
                          <Text style={[styles.entryValue, { color: colors.muted }]}>HC {entry.head_cm}cm</Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.sm },
  backButton: { padding: 4 },
  title: { flex: 1, fontSize: 24, fontWeight: '800' },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  addButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  loader: { marginTop: Spacing.xl },
  chartsCard: { borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.lg },
  divider: { height: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingHorizontal: Spacing.xs },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  entryDate: { flex: 1 },
  entryDateText: { fontSize: 15, fontWeight: '600' },
  entryValues: { flexDirection: 'row', gap: Spacing.sm },
  entryValue: { fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyButton: { borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  emptyButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
