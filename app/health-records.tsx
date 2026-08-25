import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useActiveChild } from '@/hooks/use-active-child';
import { useMemberRole } from '@/hooks/use-member-role';
import { useAppStore } from '@/store/app-store';
import { formatDateInput, parseDateInput, parseCalendarDate } from '@/lib/calendar-date';
import { getErrorMessage } from '@/lib/error-message';
import { useBottomInset } from '@/components/shared/KeyboardSafeScreen';
import {
  getHealthRecords,
  addHealthRecord,
  deleteHealthRecord,
} from '@/services/health-records';
import type {
  HealthRecord,
  HealthRecordType,
  VisitMetadata,
  NoteMetadata,
} from '@/lib/database.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const RECORD_TYPES: HealthRecordType[] = ['visit', 'note'];

const TYPE_LABELS: Record<HealthRecordType, string> = {
  measurement: 'Measurement',
  visit: 'Doctor visit',
  vaccination: 'Vaccination',
  note: 'Health note',
};

const TYPE_EMOJIS: Record<HealthRecordType, string> = {
  measurement: '📏',
  visit: '🩺',
  vaccination: '💉',
  note: '📋',
};

const TYPE_COLORS: Record<HealthRecordType, string> = {
  measurement: '#6B9080', // seaGlass
  visit: '#C4856A',       // terracotta
  vaccination: '#7A8489', // slateBlue
  note: '#B0B6AC',        // sageGreen
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayInput(): string {
  const t = new Date();
  return `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear()}`;
}

function recordSummary(record: HealthRecord): string {
  const meta = record.metadata as Record<string, unknown>;
  switch (record.type) {
    case 'measurement': {
      const parts: string[] = [];
      if (meta.weight_kg != null) parts.push(`${meta.weight_kg} kg`);
      if (meta.height_cm != null) parts.push(`${meta.height_cm} cm`);
      if (meta.head_cm != null) parts.push(`Head ${meta.head_cm} cm`);
      return parts.length > 0 ? parts.join(' · ') : 'No measurements recorded';
    }
    case 'visit': {
      const parts: string[] = [];
      if (meta.doctor) parts.push(String(meta.doctor));
      if (meta.reason) parts.push(String(meta.reason));
      return parts.length > 0 ? parts.join(' · ') : 'Doctor visit';
    }
    case 'vaccination':
      return meta.vaccine ? String(meta.vaccine) : 'Vaccination';
    case 'note':
      return meta.title ? String(meta.title) : record.notes ?? 'Note';
    default:
      return '';
  }
}

function groupByMonth(records: HealthRecord[]): { title: string; data: HealthRecord[] }[] {
  const groups: Map<string, HealthRecord[]> = new Map();
  for (const r of records) {
    const key = format(parseCalendarDate(r.recorded_at), 'MMMM yyyy');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
}

type AppColors = typeof Colors.light | typeof Colors.dark;

// ─── Add Record Modal ─────────────────────────────────────────────────────────

function AddRecordModal({
  visible,
  colors,
  onClose,
  onSaved,
  childId,
  userId,
}: {
  visible: boolean;
  colors: AppColors;
  onClose: () => void;
  onSaved: () => void;
  childId: string | null;
  userId: string | null;
}) {
  const [type, setType] = useState<HealthRecordType>('visit');
  const [date, setDate] = useState(todayInput);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const bottomInset = useBottomInset();

  const [doctor, setDoctor] = useState('');
  const [clinic, setClinic] = useState('');
  const [reason, setReason] = useState('');
  const [noteTitle, setNoteTitle] = useState('');

  const resetForm = () => {
    setDate(todayInput());
    setNotes('');
    setDoctor(''); setClinic(''); setReason('');
    setNoteTitle('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (!childId || !userId) return;

    const parsedDate = parseDateInput(date);
    if (!parsedDate) {
      Alert.alert('Invalid date', 'Please enter a valid date (DD/MM/YYYY) that is not in the future.');
      return;
    }

    let metadata: VisitMetadata | NoteMetadata | Record<string, never> = {};

    if (type === 'visit') {
      const v: VisitMetadata = {};
      if (doctor.trim()) v.doctor = doctor.trim();
      if (clinic.trim()) v.clinic = clinic.trim();
      if (reason.trim()) v.reason = reason.trim();
      metadata = v;
    } else if (type === 'note') {
      if (!noteTitle.trim() && !notes.trim()) {
        Alert.alert('Add content', 'Please enter a title or notes for this health note.');
        return;
      }
      const n: NoteMetadata = { title: noteTitle.trim() || notes.trim() };
      metadata = n;
    }

    setIsSaving(true);
    try {
      const [y, m, d] = parsedDate.split('-').map(Number);
      await addHealthRecord({
        childId,
        type,
        recordedAt: new Date(y, m - 1, d),
        notes: notes.trim() || undefined,
        metadata,
        userId,
      });
      resetForm();
      onSaved();
    } catch (e: unknown) {
      Alert.alert('Error', getErrorMessage(e, 'Failed to save record.'));
    } finally {
      setIsSaving(false);
    }
  };

  const accent = TYPE_COLORS[type];

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.modalBackdrop} onPress={handleClose} />
        <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: Spacing.lg + bottomInset }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            Add visit or note
          </Text>

          {/* Type selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeRow}>
            {RECORD_TYPES.map((t) => {
              const active = t === type;
              const tc = TYPE_COLORS[t];
              return (
                <Pressable
                  key={t}
                  style={[
                    styles.typeChip,
                    active
                      ? { backgroundColor: tc }
                      : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                  ]}
                  onPress={() => setType(t)}>
                  <Text style={styles.typeChipEmoji}>{TYPE_EMOJIS[t]}</Text>
                  <Text style={[styles.typeChipLabel, { color: active ? '#fff' : colors.muted }]}>
                    {TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            style={styles.modalScrollArea}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* Date */}
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Date</Text>
            <TextInput
              style={inputStyle}
              value={date}
              onChangeText={(v) => setDate(formatDateInput(v))}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
            />

            {type === 'visit' && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>Doctor / Practitioner</Text>
                <TextInput
                  style={inputStyle}
                  value={doctor}
                  onChangeText={setDoctor}
                  placeholder="e.g. Dr Smith"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="words"
                />
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>Clinic / Hospital</Text>
                <TextInput
                  style={inputStyle}
                  value={clinic}
                  onChangeText={setClinic}
                  placeholder="e.g. City Health Centre"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="words"
                />
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>Reason for visit</Text>
                <TextInput
                  style={inputStyle}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="e.g. 8-week check"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="sentences"
                />
              </>
            )}

            {type === 'note' && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>Title</Text>
                <TextInput
                  style={inputStyle}
                  value={noteTitle}
                  onChangeText={setNoteTitle}
                  placeholder="e.g. Rash observed"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="sentences"
                />
              </>
            )}

            {/* Notes — shared across all types */}
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Notes (optional)</Text>
            <TextInput
              style={[inputStyle, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional observations…"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Pressable
              style={[styles.saveButton, { backgroundColor: accent }, isSaving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </Pressable>

            <Pressable style={styles.cancelButton} onPress={handleClose}>
              <Text style={[styles.cancelButtonText, { color: colors.muted }]}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Record Row ───────────────────────────────────────────────────────────────

function RecordRow({
  record,
  colors,
  canWrite,
  onDelete,
}: {
  record: HealthRecord;
  colors: AppColors;
  canWrite: boolean;
  onDelete: (id: string) => void;
}) {
  const accent = TYPE_COLORS[record.type];
  const dateStr = format(parseCalendarDate(record.recorded_at), 'd MMM yyyy');
  const summary = recordSummary(record);
  const notes = record.notes;

  const confirmDelete = () => {
    Alert.alert(
      'Delete record',
      'Remove this visit or note? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(record.id),
        },
      ],
    );
  };

  return (
    <Pressable
      style={[styles.recordRow, { borderColor: colors.border }]}
      onLongPress={canWrite ? confirmDelete : undefined}
      accessibilityLabel={`${TYPE_LABELS[record.type]} on ${dateStr}: ${summary}`}>
      <View style={[styles.recordIconWrap, { backgroundColor: accent + '20' }]}>
        <Text style={styles.recordEmoji}>{TYPE_EMOJIS[record.type]}</Text>
      </View>
      <View style={styles.recordBody}>
        <View style={styles.recordMeta}>
          <Text style={[styles.recordType, { color: accent }]}>{TYPE_LABELS[record.type]}</Text>
          <Text style={[styles.recordDate, { color: colors.muted }]}>{dateStr}</Text>
        </View>
        <Text style={[styles.recordSummary, { color: colors.text }]} numberOfLines={2}>
          {summary}
        </Text>
        {notes ? (
          <Text style={[styles.recordNotes, { color: colors.muted }]} numberOfLines={1}>
            {notes}
          </Text>
        ) : null}
      </View>
      {canWrite && (
        <Pressable style={styles.deleteHitArea} onPress={confirmDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={16} color={colors.muted} />
        </Pressable>
      )}
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type ListItem =
  | { kind: 'header'; title: string }
  | { kind: 'record'; record: HealthRecord };

export default function HealthRecordsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const bottomInset = useBottomInset();
  const { session } = useAuth();
  const { activeChild } = useActiveChild(session?.user.id ?? null);
  const activeChildId = useAppStore((s) => s.activeChildId);
  const { canWrite } = useMemberRole(activeChildId, session?.user.id ?? null);

  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    if (!activeChildId) return;
    setIsLoading(true);
    try {
      const data = await getHealthRecords(activeChildId);
      setRecords(data);
    } catch (e: unknown) {
      Alert.alert('Error', getErrorMessage(e, 'Failed to load health records.'));
    } finally {
      setIsLoading(false);
    }
  }, [activeChildId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteHealthRecord(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch (e: unknown) {
      Alert.alert('Error', getErrorMessage(e, 'Failed to delete record.'));
    }
  }, []);

  // Build flat list items from grouped records
  const listItems: ListItem[] = [];
  const groups = groupByMonth(records);
  for (const group of groups) {
    listItems.push({ kind: 'header', title: group.title });
    for (const record of group.data) {
      listItems.push({ kind: 'record', record });
    }
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            Visits & notes
          </Text>
          {activeChild ? (
            <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
              {activeChild.name}
            </Text>
          ) : null}
        </View>
        {canWrite && (
          <Pressable
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowAdd(true)}
            accessibilityLabel="Add visit or note">
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        )}
      </View>

      {isLoading && records.length === 0 ? (
        <View style={styles.centred}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : records.length === 0 ? (
        <View style={styles.centred}>
          <Text style={styles.emptyEmoji}>🩺</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No visits or notes yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            {canWrite
              ? 'Tap + to log a doctor visit or a health note. Growth and vaccines live on their own screens.'
              : 'Visits and notes logged by the owner will appear here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={(item, i) =>
            item.kind === 'header' ? `h-${item.title}` : `r-${item.record.id}-${i}`
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: Spacing.xxl + bottomInset }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <Text style={[styles.sectionHeader, { color: colors.muted }]}>
                  {item.title.toUpperCase()}
                </Text>
              );
            }
            return (
              <RecordRow
                record={item.record}
                colors={colors}
                canWrite={canWrite}
                onDelete={handleDelete}
              />
            );
          }}
        />
      )}

      <AddRecordModal
        visible={showAdd}
        colors={colors}
        childId={activeChildId}
        userId={session?.user.id ?? null}
        onClose={() => setShowAdd(false)}
        onSaved={() => {
          setShowAdd(false);
          load();
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyEmoji: { fontSize: 52, marginBottom: Spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: Spacing.sm, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, lineHeight: 22, textAlign: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  backButton: { padding: Spacing.xs },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSubtitle: { fontSize: 13, marginTop: 1 },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // List
  listContent: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xxl },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },

  // Record row
  recordRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    backgroundColor: 'transparent',
  },
  recordIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  recordEmoji: { fontSize: 22 },
  recordBody: { flex: 1, gap: 2 },
  recordMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordType: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  recordDate: { fontSize: 12 },
  recordSummary: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  recordNotes: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  deleteHitArea: { padding: Spacing.xs, alignSelf: 'center' },

  // Modal
  modalWrapper: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    paddingTop: Spacing.md,
    maxHeight: '92%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: Spacing.md,
  },
  typeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    paddingRight: Spacing.md,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  typeChipEmoji: { fontSize: 16 },
  typeChipLabel: { fontSize: 13, fontWeight: '600' },
  modalScrollArea: { flexShrink: 1 },

  // Form
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  input: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  saveButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: Spacing.lg,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelButton: { alignItems: 'center', paddingVertical: Spacing.md },
  cancelButtonText: { fontSize: 15, fontWeight: '600' },
});
