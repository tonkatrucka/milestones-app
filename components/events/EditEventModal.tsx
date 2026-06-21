import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Colors, EventColors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { updateEvent, deleteEvent } from '@/services/events';
import type {
  DailyEvent,
  EventType,
  NappyMetadata,
  MealMetadata,
  SleepMetadata,
} from '@/lib/database.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EditEventModalProps {
  event: DailyEvent | null;
  visible: boolean;
  onClose: () => void;
  onSaved: (updated: DailyEvent) => void;
  onDeleted: (id: string) => void;
}

type ModalMode = 'actions' | 'edit';

// ─── Constants ────────────────────────────────────────────────────────────────

const NAPPY_TYPES: NappyMetadata['nappyType'][] = ['wet', 'dirty', 'both', 'dry'];
const MEAL_TYPES: MealMetadata['mealType'][] = ['breast', 'bottle', 'solid', 'snack'];
const EVENT_LABELS: Record<EventType, string> = { nappy: 'Nappy', meal: 'Meal', sleep: 'Sleep' };
const EVENT_EMOJIS: Record<EventType, string> = { nappy: '🧷', meal: '🍼', sleep: '😴' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Return a copy of `base` with hours/minutes replaced by those from `timeSrc`. */
function mergeTime(base: Date, timeSrc: Date): Date {
  const d = new Date(base);
  d.setHours(timeSrc.getHours(), timeSrc.getMinutes(), 0, 0);
  return d;
}

function eventSummary(event: DailyEvent): string {
  const meta = event.metadata as Record<string, unknown>;
  switch (event.type) {
    case 'nappy': {
      const t = (meta as NappyMetadata).nappyType;
      return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Nappy change';
    }
    case 'meal': {
      const m = meta as MealMetadata;
      const parts: string[] = [];
      if (m.mealType) parts.push(m.mealType.charAt(0).toUpperCase() + m.mealType.slice(1));
      if (m.amountMl) parts.push(`${m.amountMl}ml`);
      if (m.food) parts.push(m.food);
      return parts.join(' · ') || 'Meal';
    }
    case 'sleep': {
      const m = meta as SleepMetadata;
      return m.sleepEnd ? 'Completed sleep' : 'Ongoing sleep';
    }
    default:
      return event.type;
  }
}

// ─── Time picker sub-component ────────────────────────────────────────────────

function TimePicker({
  label,
  value,
  onChange,
  scheme,
  colors,
  accent,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  scheme: 'light' | 'dark';
  colors: typeof Colors.light;
  accent: string;
}) {
  const [showAndroid, setShowAndroid] = useState(false);
  return (
    <View>
      <Text style={[modalStyles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={value}
          mode="time"
          display="spinner"
          onChange={(_, d) => d && onChange(d)}
          themeVariant={scheme}
          style={modalStyles.iosPicker}
        />
      ) : (
        <Pressable
          style={[
            modalStyles.androidBtn,
            { backgroundColor: colors.inputBackground, borderColor: colors.border },
          ]}
          onPress={() => setShowAndroid(true)}>
          <Text style={[modalStyles.androidBtnText, { color: colors.text }]}>
            🕐 {format(value, 'h:mm a')}
          </Text>
          <Text style={[modalStyles.androidBtnHint, { color: colors.muted }]}>Tap to change</Text>
        </Pressable>
      )}
      {showAndroid && Platform.OS === 'android' && (
        <DateTimePicker
          value={value}
          mode="time"
          display="default"
          onChange={(_, d) => {
            setShowAndroid(false);
            if (d) onChange(d);
          }}
        />
      )}
    </View>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function EditEventModal({
  event,
  visible,
  onClose,
  onSaved,
  onDeleted,
}: EditEventModalProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [mode, setMode] = useState<ModalMode>('actions');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit form state
  const [time, setTime] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [nappyType, setNappyType] = useState<NappyMetadata['nappyType']>('wet');
  const [mealType, setMealType] = useState<MealMetadata['mealType']>('bottle');
  const [amount, setAmount] = useState('');
  const [food, setFood] = useState('');
  const [sleepStart, setSleepStart] = useState(new Date());
  const [sleepEnd, setSleepEnd] = useState(new Date());
  const [hasSleepEnd, setHasSleepEnd] = useState(false);

  // Re-initialise form state whenever the event changes or the modal opens
  useEffect(() => {
    if (!event || !visible) return;
    setMode('actions');
    setIsSaving(false);
    setIsDeleting(false);

    const occurred = new Date(event.occurred_at);
    setTime(occurred);
    setNotes(event.notes ?? '');

    if (event.type === 'nappy') {
      setNappyType((event.metadata as NappyMetadata).nappyType ?? 'wet');
    } else if (event.type === 'meal') {
      const m = event.metadata as MealMetadata;
      setMealType(m.mealType ?? 'bottle');
      setAmount(m.amountMl != null ? String(m.amountMl) : '');
      setFood(m.food ?? '');
    } else if (event.type === 'sleep') {
      setSleepStart(occurred);
      const sleepMeta = event.metadata as SleepMetadata;
      const end = sleepMeta.sleepEnd ? new Date(sleepMeta.sleepEnd) : new Date();
      setSleepEnd(end);
      setHasSleepEnd(!!sleepMeta.sleepEnd);
    }
  }, [event, visible]);

  if (!event) return null;

  const accent = EventColors[event.type as EventType];
  const typeLabel = EVENT_LABELS[event.type as EventType];
  const typeEmoji = EVENT_EMOJIS[event.type as EventType];

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let occurred_at: string;
      let metadata: DailyEvent['metadata'];

      if (event.type === 'sleep') {
        occurred_at = sleepStart.toISOString();
        const sleepMeta: SleepMetadata = {};
        if (hasSleepEnd) {
          if (sleepEnd <= sleepStart) {
            Alert.alert('Invalid time', 'Wake-up time must be after the sleep start time.');
            setIsSaving(false);
            return;
          }
          sleepMeta.sleepEnd = sleepEnd.toISOString();
        }
        metadata = sleepMeta;
      } else {
        occurred_at = time.toISOString();
        if (event.type === 'nappy') {
          metadata = { nappyType } as NappyMetadata;
        } else {
          const m: Record<string, unknown> = { mealType };
          if (mealType === 'bottle' || mealType === 'breast') {
            if (amount) m.amountMl = parseInt(amount, 10);
          }
          if (mealType === 'solid' || mealType === 'snack') {
            if (food) m.food = food;
          }
          metadata = m as MealMetadata;
        }
      }

      const updated = await updateEvent(event.id, {
        occurred_at,
        metadata,
        notes: notes.trim() || null,
      });
      onSaved(updated);
      onClose();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      `Delete ${typeLabel}`,
      `Remove this ${typeLabel.toLowerCase()} entry? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteEvent(event.id);
              onDeleted(event.id);
              onClose();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={modalStyles.sheetWrapper}>
          <View style={[modalStyles.sheet, { backgroundColor: colors.card }, mode === 'edit' && modalStyles.sheetEdit]}>
            <View style={[modalStyles.handle, { backgroundColor: colors.border }]} />

            {mode === 'actions' ? (
              /* ── Action sheet ── */
              <View style={modalStyles.actionContent}>
                <View style={[modalStyles.summaryCard, { backgroundColor: accent + '15', borderColor: accent + '40' }]}>
                  <Text style={modalStyles.summaryEmoji}>{typeEmoji}</Text>
                  <View style={modalStyles.summaryBody}>
                    <Text style={[modalStyles.summaryTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>
                      {typeLabel}
                    </Text>
                    <Text style={[modalStyles.summaryDetail, { color: colors.muted }]}>
                      {eventSummary(event)}
                    </Text>
                    <Text style={[modalStyles.summaryTime, { color: accent }]}>
                      {format(new Date(event.occurred_at), 'EEE d MMM · h:mm a')}
                    </Text>
                    {event.notes ? (
                      <Text style={[modalStyles.summaryNotes, { color: colors.muted }]} numberOfLines={2}>
                        {event.notes}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={modalStyles.actionButtons}>
                  <Pressable
                    style={[modalStyles.actionBtn, { backgroundColor: colors.primary }]}
                    onPress={() => setMode('edit')}>
                    <Ionicons name="pencil" size={17} color="#fff" />
                    <Text style={modalStyles.actionBtnText}>Edit</Text>
                  </Pressable>

                  <Pressable
                    style={[modalStyles.actionBtn, { backgroundColor: colors.danger }]}
                    onPress={handleDelete}
                    disabled={isDeleting}>
                    {isDeleting ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="trash" size={17} color="#fff" />
                        <Text style={modalStyles.actionBtnText}>Delete</Text>
                      </>
                    )}
                  </Pressable>
                </View>

                <Pressable
                  style={[modalStyles.cancelBtn, { borderColor: colors.border }]}
                  onPress={onClose}>
                  <Text style={[modalStyles.cancelBtnText, { color: colors.muted }]}>Cancel</Text>
                </Pressable>
              </View>
            ) : (
              /* ── Edit form ── */
              <View style={modalStyles.editContent}>
                <View style={modalStyles.editHeader}>
                  <Pressable onPress={() => setMode('actions')} hitSlop={10}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                  </Pressable>
                  <Text style={[modalStyles.editTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>
                    Edit {typeLabel}
                  </Text>
                  <View style={{ width: 22 }} />
                </View>

                <ScrollView
                  style={modalStyles.editScroll}
                  contentContainerStyle={modalStyles.editFields}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}>

                  {event.type !== 'sleep' && (
                    <TimePicker
                      label="Time"
                      value={time}
                      onChange={(d) => setTime(mergeTime(time, d))}
                      scheme={scheme}
                      colors={colors}
                      accent={accent}
                    />
                  )}

                  {event.type === 'sleep' && (
                    <>
                      <TimePicker
                        label="Fell asleep at"
                        value={sleepStart}
                        onChange={(d) => setSleepStart(mergeTime(sleepStart, d))}
                        scheme={scheme}
                        colors={colors}
                        accent={accent}
                      />
                      {hasSleepEnd ? (
                        <TimePicker
                          label="Woke up at"
                          value={sleepEnd}
                          onChange={(d) => setSleepEnd(mergeTime(sleepEnd, d))}
                          scheme={scheme}
                          colors={colors}
                          accent={accent}
                        />
                      ) : (
                        <Pressable
                          style={[modalStyles.addWakeupBtn, { borderColor: accent, backgroundColor: accent + '12' }]}
                          onPress={() => { setSleepEnd(new Date()); setHasSleepEnd(true); }}>
                          <Ionicons name="sunny-outline" size={16} color={accent} />
                          <Text style={[modalStyles.addWakeupText, { color: accent }]}>Add wake-up time</Text>
                        </Pressable>
                      )}
                    </>
                  )}

                  {event.type === 'nappy' && (
                    <View>
                      <Text style={[modalStyles.fieldLabel, { color: colors.muted }]}>Type</Text>
                      <View style={modalStyles.optionRow}>
                        {NAPPY_TYPES.map((t) => (
                          <Pressable
                            key={t}
                            style={[
                              modalStyles.optionChip,
                              { backgroundColor: nappyType === t ? accent : colors.inputBackground },
                            ]}
                            onPress={() => setNappyType(t)}>
                            <Text style={[modalStyles.optionText, { color: nappyType === t ? '#fff' : colors.text }]}>
                              {t.charAt(0).toUpperCase() + t.slice(1)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}

                  {event.type === 'meal' && (
                    <>
                      <View>
                        <Text style={[modalStyles.fieldLabel, { color: colors.muted }]}>Meal type</Text>
                        <View style={modalStyles.optionRow}>
                          {MEAL_TYPES.map((t) => (
                            <Pressable
                              key={t}
                              style={[
                                modalStyles.optionChip,
                                { backgroundColor: mealType === t ? accent : colors.inputBackground },
                              ]}
                              onPress={() => setMealType(t)}>
                              <Text style={[modalStyles.optionText, { color: mealType === t ? '#fff' : colors.text }]}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                      {(mealType === 'bottle' || mealType === 'breast') && (
                        <View>
                          <Text style={[modalStyles.fieldLabel, { color: colors.muted }]}>Amount (ml)</Text>
                          <TextInput
                            style={[modalStyles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                            placeholder="e.g. 120"
                            placeholderTextColor={colors.muted}
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="numeric"
                          />
                        </View>
                      )}
                      {(mealType === 'solid' || mealType === 'snack') && (
                        <View>
                          <Text style={[modalStyles.fieldLabel, { color: colors.muted }]}>Food</Text>
                          <TextInput
                            style={[modalStyles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                            placeholder="e.g. Pureed carrot"
                            placeholderTextColor={colors.muted}
                            value={food}
                            onChangeText={setFood}
                          />
                        </View>
                      )}
                    </>
                  )}

                  <View>
                    <Text style={[modalStyles.fieldLabel, { color: colors.muted }]}>Notes (optional)</Text>
                    <TextInput
                      style={[
                        modalStyles.input,
                        modalStyles.notesInput,
                        { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border },
                      ]}
                      placeholder="Any observations…"
                      placeholderTextColor={colors.muted}
                      value={notes}
                      onChangeText={setNotes}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </ScrollView>

                <Pressable
                  style={[modalStyles.saveBtn, { backgroundColor: accent }, isSaving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={isSaving}>
                  {isSaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={modalStyles.saveBtnText}>Save changes</Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetWrapper: {
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '92%',
  },
  // In edit mode give the sheet a fixed height so flex children can fill it
  sheetEdit: {
    height: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },

  // Action sheet
  actionContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  summaryEmoji: {
    fontSize: 28,
    lineHeight: 34,
  },
  summaryBody: {
    flex: 1,
    gap: 2,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  summaryDetail: {
    fontSize: 14,
  },
  summaryTime: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  summaryNotes: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    minHeight: 48,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelBtn: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Edit form
  editContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  editTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  editScroll: {
    flex: 1,
  },
  editFields: {
    gap: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    letterSpacing: 0.3,
  },
  iosPicker: {
    marginLeft: -Spacing.sm,
    height: 120,
  },
  androidBtn: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  androidBtnText: { fontSize: 16, fontWeight: '600' },
  androidBtnHint: { fontSize: 13 },
  addWakeupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignSelf: 'flex-start',
  },
  addWakeupText: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  optionChip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  optionText: { fontSize: 14, fontWeight: '600' },
  input: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 15,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: Spacing.xs,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
