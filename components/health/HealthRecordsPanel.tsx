import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useSafeBottomTabBarHeight } from '@/hooks/use-safe-tab-bar-height';

const RECORD_LINKS = [
  { label: 'Visits & notes', emoji: '🩺', path: '/health-records' },
  { label: 'Growth tracker', emoji: '📏', path: '/growth' },
  { label: 'Foods introduced', emoji: '🥕', path: '/foods' },
  { label: 'Vaccinations', emoji: '💉', path: '/vaccinations' },
  { label: 'Developmental checklist', emoji: '🌱', path: '/checklist' },
  { label: 'First words dictionary', emoji: '💬', path: '/words' },
  { label: 'Time capsule', emoji: '⏳', path: '/capsule' },
] as const;

export function HealthRecordsPanel({
  colors,
}: {
  colors: typeof Colors.light;
}) {
  const router = useRouter();
  const tabBarHeight = useSafeBottomTabBarHeight();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.scroll,
        { paddingBottom: tabBarHeight + Spacing.lg },
      ]}>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Preview a doctor visit summary, or open visits and notes, growth, foods, vaccinations, the
        checklist, and keepsakes.
      </Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable
          style={[styles.navRow, { borderColor: colors.border }]}
          onPress={() => router.push('/visit-summary' as never)}
          accessibilityRole="button"
          accessibilityLabel="Doctor visit summary">
          <Text style={styles.navEmoji}>📄</Text>
          <View style={styles.navLabelBlock}>
            <Text style={[styles.navLabelStacked, { color: colors.text }]}>
              Doctor visit summary
            </Text>
            <Text style={[styles.navHint, { color: colors.muted }]}>
              Preview measurements, vaccines, allergens, development, and 7-day averages
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
        {RECORD_LINKS.map(({ label, emoji, path }, index) => (
          <Pressable
            key={path}
            style={[
              styles.navRow,
              { borderColor: colors.border },
              index === RECORD_LINKS.length - 1 && styles.navRowLast,
            ]}
            onPress={() => router.push(path as never)}
            accessibilityRole="button"
            accessibilityLabel={label}>
            <Text style={styles.navEmoji}>{emoji}</Text>
            <Text style={[styles.navLabel, { color: colors.text }]}>{label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navRowLast: {
    borderBottomWidth: 0,
  },
  navEmoji: { fontSize: 20, width: 28 },
  navLabelBlock: { flex: 1, gap: 2 },
  navLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  navLabelStacked: { fontSize: 15, fontWeight: '600' },
  navHint: { fontSize: 12, lineHeight: 16 },
});
