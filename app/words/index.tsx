/**
 * First Words Dictionary screen
 * Tracks each word the child has said with date and optional phonetic note.
 */
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useAppStore } from '@/store/app-store';
import { useMemberRole } from '@/hooks/use-member-role';
import { getFirstWords, addFirstWord, deleteFirstWord } from '@/services/first-words';
import type { FirstWord } from '@/lib/database.types';

export default function FirstWordsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const { session } = useAuth();
  const activeChildId = useAppStore((s) => s.activeChildId);
  const { canWrite } = useMemberRole(activeChildId, session?.user.id ?? null);

  const [words, setWords] = useState<FirstWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [word, setWord] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!activeChildId) return;
    try {
      setWords(await getFirstWords(activeChildId));
    } finally {
      setIsLoading(false);
    }
  }, [activeChildId]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleAdd = async () => {
    if (!word.trim() || !activeChildId || !session?.user.id) return;
    setIsSaving(true);
    try {
      const newWord = await addFirstWord({
        childId: activeChildId,
        word: word.trim(),
        phonetic: phonetic.trim() || undefined,
        userId: session.user.id,
      });
      setWords((prev) => [newWord, ...prev]);
      setWord('');
      setPhonetic('');
      setShowAdd(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string, w: string) => {
    Alert.alert(`Remove "${w}"?`, '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteFirstWord(id); setWords((p) => p.filter((fw) => fw.id !== id)); }
          catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            First Words
          </Text>
          <Text style={[styles.count, { color: colors.muted }]}>
            {words.length} word{words.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {canWrite && (
          <Pressable
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowAdd(true)}>
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : words.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            Their first dictionary
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Every word is a miracle. Log them as they come — what they say, how they actually say it, and when it first happened.
          </Text>
          {canWrite && (
            <Pressable
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowAdd(true)}>
              <Text style={styles.emptyBtnText}>Add first word</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={words}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.wordRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              onLongPress={() => canWrite && handleDelete(item.id, item.word)}>
              <View style={styles.wordInfo}>
                <Text style={[styles.wordText, { color: colors.text }]}>{item.word}</Text>
                {item.phonetic && (
                  <Text style={[styles.phoneticText, { color: colors.muted }]}>
                    &quot;{item.phonetic}&quot;
                  </Text>
                )}
              </View>
              <Text style={[styles.wordDate, { color: colors.muted }]}>
                {format(parseISO(item.said_at), 'd MMM yyyy')}
              </Text>
            </Pressable>
          )}
        />
      )}

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowAdd(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <Text style={[styles.sheetTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            Add a word
          </Text>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Word</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
            placeholder="e.g. Mama, Dog, More"
            placeholderTextColor={colors.muted}
            value={word}
            onChangeText={setWord}
            autoFocus
            autoCapitalize="words"
          />
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>How they say it (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
            placeholder='e.g. "baba" for bottle'
            placeholderTextColor={colors.muted}
            value={phonetic}
            onChangeText={setPhonetic}
          />
          <Pressable
            style={[styles.saveBtn, { backgroundColor: colors.primary }, (!word.trim() || isSaving) && { opacity: 0.5 }]}
            onPress={handleAdd}
            disabled={!word.trim() || isSaving}>
            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save word</Text>}
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  headerCenter: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800' },
  count: { fontSize: 13 },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  loader: { marginTop: Spacing.xl },
  list: { padding: Spacing.md, gap: Spacing.sm },
  wordRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  wordInfo: { flex: 1 },
  wordText: { fontSize: 17, fontWeight: '700' },
  phoneticText: { fontSize: 13, marginTop: 2, fontStyle: 'italic' },
  wordDate: { fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.lg },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, gap: Spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  input: { borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: 15 },
  saveBtn: { borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
