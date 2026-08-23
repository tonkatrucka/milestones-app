/**
 * GrowthChart — a pure React Native bar/line visualisation of weight over time.
 * No SVG dependency. Uses View-based bars with relative sizing.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { format, parseISO } from 'date-fns';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { GrowthEntry } from '@/lib/database.types';

interface GrowthChartProps {
  entries: GrowthEntry[];
  metric: 'weight_kg' | 'height_cm' | 'head_cm';
  label: string;
  unit: string;
  accentColor: string;
}

export function GrowthChart({ entries, metric, label, unit, accentColor }: GrowthChartProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const validEntries = [...entries]
    .filter((e) => e[metric] != null)
    .sort((a, b) => a.measured_at.localeCompare(b.measured_at));

  if (validEntries.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.muted }]}>No {label.toLowerCase()} data yet</Text>
      </View>
    );
  }

  const values = validEntries.map((e) => e[metric] as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const chartHeight = 100;

  const lastEntry = validEntries[validEntries.length - 1];
  const prevEntry = validEntries[validEntries.length - 2];
  const lastValue = lastEntry[metric] as number;
  const delta = prevEntry ? lastValue - (prevEntry[metric] as number) : null;
  const deltaLabel = delta != null
    ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}${unit} since last`
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.metricLabel, { color: colors.muted }]}>{label.toUpperCase()}</Text>
        <View style={styles.latestRow}>
          <Text style={[styles.latestValue, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            {lastValue}{unit}
          </Text>
          {deltaLabel && (
            <Text style={[styles.delta, { color: delta! >= 0 ? '#4CAF50' : '#F44336' }]}>
              {deltaLabel}
            </Text>
          )}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
        <View style={[styles.chartArea, { height: chartHeight + 32 }]}>
          {validEntries.map((entry, i) => {
            const value = entry[metric] as number;
            const barHeight = Math.max(4, ((value - min) / range) * chartHeight);
            const dateLabel = format(parseISO(entry.measured_at), 'd MMM');
            const isLast = i === validEntries.length - 1;

            return (
              <View key={entry.id} style={styles.barGroup}>
                <Text style={[styles.barValue, { color: isLast ? accentColor : colors.muted }]}>
                  {value}
                </Text>
                <View style={styles.barContainer}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor: isLast ? accentColor : accentColor + '66',
                        borderRadius: Radius.sm,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barDate, { color: colors.muted }]}>{dateLabel}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const BAR_WIDTH = 40;

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  headerRow: { gap: 2 },
  metricLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  latestRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  latestValue: { fontSize: 24, fontWeight: '800' },
  delta: { fontSize: 12, fontWeight: '600' },
  empty: { height: 60, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, fontStyle: 'italic' },
  chartScroll: { marginHorizontal: -Spacing.sm },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
  },
  barGroup: {
    width: BAR_WIDTH,
    alignItems: 'center',
    gap: 2,
  },
  barValue: { fontSize: 9, fontWeight: '600' },
  barContainer: { width: BAR_WIDTH - 8, justifyContent: 'flex-end', height: 100 },
  bar: { width: '100%' },
  barDate: { fontSize: 9, textAlign: 'center' },
});
