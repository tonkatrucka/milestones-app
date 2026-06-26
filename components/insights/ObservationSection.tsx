import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface Props {
  shortInsights: string[];
  longInsights: string[];
}

export function ObservationSection({ shortInsights, longInsights }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [expanded, setExpanded] = useState(false);

  if (shortInsights.length === 0 && longInsights.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>
          Observations
        </Text>
        <Text style={[styles.muted, { color: colors.muted }]}>
          Log feeds, naps, and nappies over a few days and a simple summary will appear here.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>
        Observations
      </Text>

      {shortInsights.map((line, i) => (
        <View key={`short-${i}`} style={styles.bulletRow}>
          <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
          <Text style={[styles.bulletText, { color: colors.text }]}>{line}</Text>
        </View>
      ))}

      {longInsights.length > 0 && (
        <>
          <Pressable onPress={() => setExpanded((v) => !v)} style={styles.expandRow}>
            <Text style={[styles.expandLabel, { color: colors.tint }]}>
              {expanded ? 'Hide more detail' : 'Read more detail'}
            </Text>
          </Pressable>
          {expanded &&
            longInsights.map((para, i) => (
              <Text key={`long-${i}`} style={[styles.longText, { color: colors.text }]}>
                {para}
              </Text>
            ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: Spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  bullet: {
    fontSize: 16,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  expandRow: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  expandLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  longText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  muted: {
    fontSize: 15,
    lineHeight: 22,
  },
});
