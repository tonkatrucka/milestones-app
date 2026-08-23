/**
 * NapPredictionCard — shows predicted next nap time on the Home screen.
 * Only visible when the prediction confidence is ≥50% and the predicted
 * nap is in the future (within the next 4 hours).
 */

import { StyleSheet, Text, View } from 'react-native';
import { format, differenceInMinutes, isAfter } from 'date-fns';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { NapPrediction } from '@/services/sleep-predictions';

interface NapPredictionCardProps {
  prediction: NapPrediction | null;
}

export function NapPredictionCard({ prediction }: NapPredictionCardProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  if (!prediction) return null;
  if (prediction.confidence < 50) return null;

  const now = new Date();
  // Only show if nap is in the future and within 4 hours
  if (!isAfter(prediction.nextNapStart, now)) return null;
  const minsUntil = differenceInMinutes(prediction.nextNapStart, now);
  if (minsUntil > 240) return null;

  const timeLabel = format(prediction.nextNapStart, 'h:mm a');
  const minsLabel = minsUntil <= 60
    ? `in ${minsUntil} min`
    : `in ${Math.floor(minsUntil / 60)}h ${minsUntil % 60}m`;

  const avgLabel = prediction.avgNapMins >= 60
    ? `~${Math.floor(prediction.avgNapMins / 60)}h ${prediction.avgNapMins % 60}m avg`
    : `~${prediction.avgNapMins}m avg`;

  const confidenceColor =
    prediction.confidence >= 75 ? '#4CAF50' :
    prediction.confidence >= 60 ? '#FF9800' : '#9E9E9E';

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}>
      <View style={styles.row}>
        <Text style={styles.emoji}>😴</Text>
        <View style={styles.content}>
          <Text style={[styles.label, { color: colors.muted }]}>NEXT NAP</Text>
          <Text style={[styles.time, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            {timeLabel}
          </Text>
          <Text style={[styles.detail, { color: colors.muted }]}>
            {minsLabel} · {avgLabel}
          </Text>
        </View>
        <View style={[styles.confidenceDot, { backgroundColor: confidenceColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emoji: { fontSize: 24 },
  content: { flex: 1 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  time: {
    fontSize: 20,
    fontWeight: '800',
  },
  detail: {
    fontSize: 12,
    marginTop: 2,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
