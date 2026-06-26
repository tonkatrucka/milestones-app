import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ResearchBullet } from '@/services/insights';

const CATEGORY_LABELS: Record<string, string> = {
  sleep: 'Sleep',
  feeding: 'Feeding',
  development: 'Growing & learning',
  milestones: 'Milestones',
  regression: 'Tough patches',
  language: 'Talking & listening',
};

interface Props {
  bullets: ResearchBullet[];
}

export function ResearchBullets({ bullets }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const grouped = bullets.reduce<Record<string, ResearchBullet[]>>((acc, b) => {
    if (!acc[b.category]) acc[b.category] = [];
    acc[b.category].push(b);
    return acc;
  }, {});

  if (bullets.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>
          Research
        </Text>
        <Text style={[styles.muted, { color: colors.muted }]}>
          Tips from trusted sources like the NHS and CDC will show up here for your child's age.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>
        Research
      </Text>

      {Object.entries(grouped).map(([category, items]) => (
        <View key={category} style={styles.group}>
          <Text style={[styles.groupTitle, { color: colors.muted }]}>
            {CATEGORY_LABELS[category] ?? category}
          </Text>
          {items.map((b) => (
            <View key={b.id} style={styles.bulletRow}>
              <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
              <View style={styles.bulletContent}>
                <Text style={[styles.bulletText, { color: colors.text }]}>
                  {b.text}
                  {b.isNew && (
                    <Text style={[styles.newBadge, { color: colors.tint }]}> New</Text>
                  )}
                </Text>
                <Pressable
                  onPress={() => WebBrowser.openBrowserAsync(b.sourceUrl)}
                  hitSlop={8}>
                  <Text style={[styles.sourceLink, { color: colors.tint }]}>{b.sourceName}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ))}

      <Text style={[styles.disclaimer, { color: colors.muted }]}>
        From trusted health sources — not medical advice. Speak to your doctor if you have concerns.
      </Text>
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
  group: {
    marginBottom: Spacing.sm,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  bullet: {
    fontSize: 16,
    lineHeight: 22,
  },
  bulletContent: {
    flex: 1,
  },
  bulletText: {
    fontSize: 15,
    lineHeight: 22,
  },
  newBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  sourceLink: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: Spacing.sm,
  },
  muted: {
    fontSize: 15,
    lineHeight: 22,
  },
});
