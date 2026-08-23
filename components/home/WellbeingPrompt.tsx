/**
 * WellbeingPrompt — a dismissible daily check-in card on the home screen.
 * Shown once per day if no check-in has been recorded yet.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { upsertCheckin } from '@/services/wellbeing';

interface WellbeingPromptProps {
  userId: string;
  childId: string;
  onCheckedIn: () => void;
  onDismiss: () => void;
}

const EMOJI_SCALE = ['😢', '😕', '😐', '🙂', '😄'] as const;
const SCALE_LABELS = ['Very low', 'Low', 'Okay', 'Good', 'Great'] as const;

function EmojiPicker({
  label,
  value,
  onChange,
  colors,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  colors: typeof Colors.light;
}) {
  return (
    <View style={styles.pickerGroup}>
      <Text style={[styles.pickerLabel, { color: colors.muted }]}>{label}</Text>
      <View style={styles.emojiRow}>
        {EMOJI_SCALE.map((emoji, i) => (
          <Pressable
            key={i}
            style={[
              styles.emojiButton,
              value === i + 1 && { backgroundColor: colors.primary + '22', borderRadius: Radius.full },
            ]}
            onPress={() => onChange(i + 1)}
            accessibilityLabel={`${label}: ${SCALE_LABELS[i]}`}
            accessibilityRole="button"
            accessibilityState={{ selected: value === i + 1 }}>
            <Text style={[styles.emojiText, value === i + 1 && styles.emojiSelected]}>
              {emoji}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function WellbeingPrompt({
  userId,
  childId,
  onCheckedIn,
  onDismiss,
}: WellbeingPromptProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [sleep, setSleep] = useState(3);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await upsertCheckin({ userId, childId, moodScore: mood, energyScore: energy, sleepScore: sleep });
      onCheckedIn();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            How are you doing?
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            30 seconds — just for you.
          </Text>
        </View>
        <Pressable onPress={onDismiss} accessibilityLabel="Dismiss wellbeing check-in">
          <Text style={[styles.dismissText, { color: colors.muted }]}>Later</Text>
        </Pressable>
      </View>

      <EmojiPicker label="Mood" value={mood} onChange={setMood} colors={colors} />
      <EmojiPicker label="Energy" value={energy} onChange={setEnergy} colors={colors} />
      <EmojiPicker label="Sleep last night" value={sleep} onChange={setSleep} colors={colors} />

      <Pressable
        style={[styles.button, { backgroundColor: colors.primary }, isSaving && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={isSaving}>
        {isSaving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Save check-in</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  dismissText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pickerGroup: { gap: 4 },
  pickerLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  emojiButton: {
    padding: 4,
    width: 40,
    alignItems: 'center',
  },
  emojiText: { fontSize: 22, opacity: 0.5 },
  emojiSelected: { opacity: 1 },
  button: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
