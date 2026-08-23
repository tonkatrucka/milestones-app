/**
 * Time Capsule screen — create sealed letters/notes for the child's future self.
 */
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO, isFuture, differenceInDays } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useAppStore } from '@/store/app-store';
import { getTimeCapsules, createTimeCapsule, markTimeCapsuleOpened, deleteTimeCapsule } from '@/services/time-capsule';
import type { TimeCapsule } from '@/lib/database.types';

export default function TimeCapsuleScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const { session } = useAuth();
  const activeChildId = useAppStore((s) => s.activeChildId);

  const [capsules, setCapsules] = useState<TimeCapsule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [unlockDate, setUnlockDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 18);
    return d;
  });
  // Stable minimum date (tomorrow) — computed once and never recalculated during render
  const minDate = new Date(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate() + 1,
  ));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!activeChildId) return;
    try { setCapsules(await getTimeCapsules(activeChildId)); }
    finally { setIsLoading(false); }
  }, [activeChildId]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleCreate = async () => {
    if (!title.trim() || !body.trim() || !activeChildId || !session?.user.id) return;
    setIsSaving(true);
    try {
      const capsule = await createTimeCapsule({
        childId: activeChildId,
        title: title.trim(),
        body: body.trim(),
        unlockAt: unlockDate.toISOString().split('T')[0],
        userId: session.user.id,
      });
      setCapsules((prev) => [...prev, capsule].sort((a, b) => a.unlock_at.localeCompare(b.unlock_at)));
      setTitle(''); setBody(''); setShowCreate(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save');
    } finally { setIsSaving(false); }
  };

  const handleOpen = async (capsule: TimeCapsule) => {
    if (!isFuture(parseISO(capsule.unlock_at)) && !capsule.unlocked_at) {
      Alert.alert(
        `Open "${capsule.title}"?`,
        'Once opened, you can read the message.',
        [
          { text: 'Not yet', style: 'cancel' },
          {
            text: 'Open it',
            onPress: async () => {
              const updated = await markTimeCapsuleOpened(capsule.id);
              setCapsules((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            },
          },
        ],
      );
    } else if (capsule.unlocked_at) {
      Alert.alert(capsule.title, capsule.body);
    }
  };

  const handleDelete = (id: string, t: string) => {
    Alert.alert(`Delete "${t}"?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteTimeCapsule(id); setCapsules((p) => p.filter((c) => c.id !== id)); }
          catch { /* ignore */ }
        },
      },
    ]);
  };

  const sealed = capsules.filter((c) => isFuture(parseISO(c.unlock_at)));
  const unlocked = capsules.filter((c) => !isFuture(parseISO(c.unlock_at)));

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>Time Capsule</Text>
        <Pressable
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : capsules.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>⏳</Text>
          <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            Write to the future
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Seal a letter, voice note, or memory for your child to open on a special future date.
          </Text>
          <Pressable
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowCreate(true)}>
            <Text style={styles.emptyBtnText}>Write first capsule</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={[...sealed, ...unlocked]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isSealed = isFuture(parseISO(item.unlock_at));
            const daysLeft = isSealed ? differenceInDays(parseISO(item.unlock_at), new Date()) : 0;
            return (
              <Pressable
                style={[
                  styles.capsuleRow,
                  { backgroundColor: colors.card, borderColor: isSealed ? colors.border : colors.primary + '40' },
                ]}
                onPress={() => handleOpen(item)}
                onLongPress={() => handleDelete(item.id, item.title)}>
                <Text style={styles.capsuleEmoji}>{isSealed ? '🔒' : '📬'}</Text>
                <View style={styles.capsuleInfo}>
                  <Text style={[styles.capsuleTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.capsuleDate, { color: colors.muted }]}>
                    {isSealed
                      ? `Opens ${format(parseISO(item.unlock_at), 'd MMM yyyy')} · ${daysLeft} days`
                      : item.unlocked_at
                        ? `Opened ${format(parseISO(item.unlocked_at), 'd MMM yyyy')}`
                        : `Unlocked ${format(parseISO(item.unlock_at), 'd MMM yyyy')} — tap to open`}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowCreate(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={[styles.sheetTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>New time capsule</Text>

            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Title</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. A letter for your 18th birthday"
              placeholderTextColor={colors.muted}
              value={title}
              onChangeText={setTitle}
              autoFocus
            />

            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Message</Text>
            <TextInput
              style={[styles.input, styles.textarea, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
              placeholder="Write your message here…"
              placeholderTextColor={colors.muted}
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={6}
            />

            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Unlock date</Text>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={unlockDate}
                mode="date"
                display="spinner"
                minimumDate={minDate}
                onChange={(_, d) => d && setUnlockDate(d)}
              />
            ) : (
              <>
                <Pressable
                  style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={() => setShowDatePicker(true)}>
                  <Text style={{ color: colors.text }}>📅 {format(unlockDate, 'd MMMM yyyy')}</Text>
                </Pressable>
                {showDatePicker && (
                  <DateTimePicker
                    value={unlockDate}
                    mode="date"
                    display="default"
                    minimumDate={minDate}
                    onChange={(event, d) => {
                      setShowDatePicker(false);
                      if (event.type === 'set' && d) setUnlockDate(d);
                    }}
                  />
                )}
              </>
            )}

            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.primary }, (!title.trim() || !body.trim() || isSaving) && { opacity: 0.5 }]}
              onPress={handleCreate}
              disabled={!title.trim() || !body.trim() || isSaving}>
              {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Seal capsule 🔒</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  title: { flex: 1, fontSize: 22, fontWeight: '800' },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  loader: { marginTop: Spacing.xl },
  list: { padding: Spacing.md, gap: Spacing.sm },
  capsuleRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, gap: Spacing.sm },
  capsuleEmoji: { fontSize: 24 },
  capsuleInfo: { flex: 1 },
  capsuleTitle: { fontSize: 15, fontWeight: '700' },
  capsuleDate: { fontSize: 12, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.lg },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '85%' },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: Spacing.md },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.xs, marginTop: Spacing.sm },
  input: { borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: 15, marginBottom: Spacing.sm },
  textarea: { minHeight: 120, textAlignVertical: 'top' },
  saveBtn: { borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', minHeight: 48, justifyContent: 'center', marginTop: Spacing.sm },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
