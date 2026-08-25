import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface NarrativeCardProps {
  label: string;
  text: string | null;
  emptyHint: string;
  colors: typeof Colors.light;
}

export function NarrativeCard({
  label,
  text,
  emptyHint,
  colors,
}: NarrativeCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      {text ? (
        <Text style={[styles.text, { color: colors.text }]}>{text}</Text>
      ) : (
        <Text style={[styles.empty, { color: colors.muted }]}>{emptyHint}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  text: {
    fontSize: 14,
    lineHeight: 22,
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
  },
});
