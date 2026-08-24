import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface NarrativeCardProps {
  label: string;
  text: string | null;
  emptyHint: string;
  colors: typeof Colors.light;
  onGenerate?: () => void;
  isGenerating?: boolean;
  generateLabel?: string;
}

export function NarrativeCard({
  label,
  text,
  emptyHint,
  colors,
  onGenerate,
  isGenerating = false,
  generateLabel = 'Write this story',
}: NarrativeCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      {text ? (
        <Text style={[styles.text, { color: colors.text }]}>{text}</Text>
      ) : (
        <Text style={[styles.empty, { color: colors.muted }]}>{emptyHint}</Text>
      )}
      {onGenerate ? (
        <Pressable
          style={[styles.generateBtn, { borderColor: colors.primary }]}
          onPress={onGenerate}
          disabled={isGenerating}
          accessibilityRole="button"
          accessibilityLabel={generateLabel}>
          {isGenerating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.generateText, { color: colors.primary }]}>{generateLabel}</Text>
          )}
        </Pressable>
      ) : null}
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
  generateBtn: {
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    minHeight: 36,
    justifyContent: 'center',
  },
  generateText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
