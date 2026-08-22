import { ActivityIndicator, Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useNotificationPreferences } from '@/hooks/use-notification-preferences';

interface NotificationSettingsSectionProps {
  userId: string | null;
  colors: typeof Colors.light;
}

const TOGGLES = [
  {
    key: 'notify_activities' as const,
    label: 'Activities',
    description: 'When a teammate logs a nappy, meal, or sleep',
    icon: 'calendar-outline' as const,
  },
  {
    key: 'notify_memories' as const,
    label: 'Memories',
    description: 'When a teammate adds a new memory',
    icon: 'heart-outline' as const,
  },
  {
    key: 'notify_milestones' as const,
    label: 'Milestones',
    description: 'When a teammate records a milestone',
    icon: 'star-outline' as const,
  },
];

export function NotificationSettingsSection({
  userId,
  colors,
}: NotificationSettingsSectionProps) {
  const { prefs, isLoading, isSaving, pushEnabled, setPreference } =
    useNotificationPreferences(userId);

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>NOTIFICATIONS</Text>
      <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
          Get push alerts when someone on your team logs something new.
        </Text>

        {Platform.OS === 'web' && (
          <Text style={[styles.webNote, { color: colors.muted }]}>
            Push notifications are available on iOS and Android only.
          </Text>
        )}

        {!pushEnabled && Platform.OS !== 'web' && (
          <Text style={[styles.webNote, { color: colors.muted }]}>
            Allow notifications on this device to receive team alerts.
          </Text>
        )}

        {isLoading || !prefs ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          TOGGLES.map((toggle, index) => (
            <View
              key={toggle.key}
              style={[
                styles.toggleRow,
                index < TOGGLES.length - 1 && {
                  borderBottomColor: colors.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}>
              <View style={styles.toggleCopy}>
                <View style={styles.toggleTitleRow}>
                  <Ionicons name={toggle.icon} size={18} color={colors.primary} />
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>{toggle.label}</Text>
                </View>
                <Text style={[styles.toggleDescription, { color: colors.muted }]}>
                  {toggle.description}
                </Text>
              </View>
              <Switch
                value={prefs[toggle.key]}
                onValueChange={(value) => setPreference(toggle.key, value)}
                disabled={isSaving || Platform.OS === 'web'}
                trackColor={{ false: colors.border, true: colors.primary + '88' }}
                thumbColor={prefs[toggle.key] ? colors.primary : colors.elevated}
              />
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: Spacing.sm,
  },
  sectionContent: {
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 20,
  },
  webNote: {
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  loader: {
    paddingVertical: Spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  toggleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Fonts!.rounded,
  },
  toggleDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
});
