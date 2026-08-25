/**
 * HandoffSummarySheet — shows the caregiver handoff summary in a bottom sheet.
 */

import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { buildHandoffSummary, type HandoffSummary } from '@/services/handoff';
import type { DailyEvent } from '@/lib/database.types';

interface HandoffSummarySheetProps {
  visible: boolean;
  onClose: () => void;
  events: DailyEvent[];
  childName: string;
}

const HOUR_OPTIONS = [2, 4, 8] as const;

export function HandoffSummarySheet({ visible, onClose, events, childName }: HandoffSummarySheetProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const [sinceHours, setSinceHours] = useState<2 | 4 | 8>(4);
  const [summary, setSummary] = useState<HandoffSummary | null>(null);

  useEffect(() => {
    if (!visible) return;
    // Run synchronously — pure CPU calculation, no side effects
    Promise.resolve(buildHandoffSummary(events, childName, sinceHours)).then(setSummary);
  }, [visible, events, childName, sinceHours]);

  const handleShare = async () => {
    if (!summary) return;
    const text = `${childName} handoff summary\n\n${summary.lines.join('\n')}`;
    try { await Share.share({ message: text }); } catch { /* user dismissed */ }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.card, paddingBottom: insets.bottom + Spacing.md },
        ]}>
        <View style={styles.handle} />
        <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>
          Handoff summary
        </Text>

        <View style={styles.windowRow}>
          {HOUR_OPTIONS.map((h) => (
            <Pressable
              key={h}
              style={[
                styles.windowChip,
                { backgroundColor: sinceHours === h ? colors.primary : colors.inputBackground },
              ]}
              onPress={() => setSinceHours(h)}>
              <Text style={[styles.windowChipText, { color: sinceHours === h ? '#fff' : colors.muted }]}>
                Last {h}h
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {summary?.lines.map((line, i) => (
            <Text key={i} style={[styles.line, { color: colors.text }]}>{line}</Text>
          ))}
        </ScrollView>

        <Pressable
          style={[styles.shareButton, { backgroundColor: colors.primary }]}
          onPress={handleShare}>
          <Text style={styles.shareButtonText}>Share handoff</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#ccc', alignSelf: 'center', marginBottom: Spacing.xs,
  },
  title: { fontSize: 18, fontWeight: '700' },
  windowRow: { flexDirection: 'row', gap: Spacing.sm },
  windowChip: {
    borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  windowChipText: { fontSize: 13, fontWeight: '600' },
  line: { fontSize: 14, lineHeight: 22 },
  shareButton: {
    borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center', marginTop: Spacing.sm,
  },
  shareButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
