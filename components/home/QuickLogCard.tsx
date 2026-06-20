import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { differenceInMinutes, format } from 'date-fns';
import { Colors, EventColors, Fonts, Radius, Spacing } from '@/constants/theme';
import { TimeSince } from '@/components/shared/TimeSince';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { DailyEvent, EventType } from '@/lib/database.types';

const EVENT_LABELS: Record<EventType, string> = {
  nappy: 'Nappy',
  meal: 'Meal',
  sleep: 'Sleep',
};

const EVENT_EMOJIS: Record<EventType, string> = {
  nappy: '👶',
  meal: '🍼',
  sleep: '😴',
};

interface QuickLogCardProps {
  type: EventType;
  lastEvent: DailyEvent | null;
  onQuickLog: () => void;
  onViewDetail: () => void;
}

export function QuickLogCard({ type, lastEvent, onQuickLog, onViewDetail }: QuickLogCardProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const accent = EventColors[type];

  const handleQuickLog = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onQuickLog();
  };

  const sleepMeta = type === 'sleep' && lastEvent
    ? (lastEvent.metadata as { sleepEnd?: string })
    : null;
  const isSleeping = type === 'sleep' && lastEvent && !sleepMeta?.sleepEnd;

  // Live elapsed-time label, updated every minute while sleeping
  const [elapsedLabel, setElapsedLabel] = useState('');
  useEffect(() => {
    if (!isSleeping || !lastEvent) return;
    const calc = () => {
      const mins = differenceInMinutes(new Date(), new Date(lastEvent.occurred_at));
      if (mins < 1) { setElapsedLabel('just now'); return; }
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      setElapsedLabel(h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`);
    };
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, [isSleeping, lastEvent]);

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={onViewDetail}
      android_ripple={{ color: accent + '22' }}>
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
      <View style={styles.content}>
        <Text style={styles.emoji}>{EVENT_EMOJIS[type]}</Text>
        <Text style={[styles.label, { color: colors.text, fontFamily: Fonts!.rounded }]}>
          {EVENT_LABELS[type]}
        </Text>
        {/* Fixed-height area keeps the + Log button in a stable position */}
        <View style={styles.infoArea}>
          {lastEvent ? (
            <>
              <Text style={[styles.time, { color: colors.text }]}>
                {format(new Date(lastEvent.occurred_at), 'h:mm a')}
              </Text>
              {isSleeping ? (
                <>
                  <Text style={[styles.since, { color: accent }]}>Currently sleeping</Text>
                  {elapsedLabel ? (
                    <Text style={[styles.elapsed, { color: colors.muted }]}>{elapsedLabel}</Text>
                  ) : null}
                </>
              ) : (
                <TimeSince
                  date={lastEvent.occurred_at}
                  style={[styles.since, { color: colors.muted }]}
                />
              )}
            </>
          ) : (
            <Text style={[styles.since, { color: colors.muted }]}>No logs yet</Text>
          )}
        </View>
        <Pressable
          style={[styles.logButton, { backgroundColor: accent }]}
          onPress={handleQuickLog}>
          <Text style={styles.logButtonText}>+ Log</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.xs,
    alignItems: 'flex-start',
  },
  emoji: {
    fontSize: 28,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  time: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoArea: {
    // Tall enough for 2 lines (sleeping label + elapsed) so the button never shifts
    minHeight: 40,
    gap: 2,
    justifyContent: 'flex-start',
  },
  since: {
    fontSize: 12,
  },
  elapsed: {
    fontSize: 13,
    fontWeight: '600',
  },
  logButton: {
    marginTop: Spacing.xs,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    alignSelf: 'flex-start',
  },
  logButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
