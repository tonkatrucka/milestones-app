import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { differenceInMinutes, format } from 'date-fns';
import { Colors, EventColors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useRequireCanWrite } from '@/hooks/use-member-role';
import { useAppStore } from '@/store/app-store';
import { getLastEventByType, logEvent, updateEvent } from '@/services/events';
import type { DailyEvent, EventType, NappyMetadata, MealMetadata, SleepMetadata } from '@/lib/database.types';
import { useLogConfirmationStore } from '@/store/log-confirmation-store';

const NAPPY_TYPES: NappyMetadata['nappyType'][] = ['wet', 'dirty', 'both', 'dry'];
const MEAL_TYPES: MealMetadata['mealType'][] = ['breast', 'bottle', 'solid', 'snack'];

// ─── Time picker helper (iOS inline / Android modal button) ─────────────────

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
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={value}
          mode="time"
          display="spinner"
          onChange={(_, d) => d && onChange(d)}
          themeVariant={scheme}
          style={styles.iosPicker}
        />
      ) : (
        <Pressable
          style={[styles.androidTimeButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
          onPress={() => setShowAndroid(true)}>
          <Text style={[styles.androidTimeText, { color: colors.text }]}>
            🕐 {format(value, 'h:mm a')}
          </Text>
          <Text style={[styles.androidTimeHint, { color: colors.muted }]}>Tap to change</Text>
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

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function LogEventScreen() {
  const { type } = useLocalSearchParams<{ type: EventType }>();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const { session } = useAuth();
  const activeChildId = useAppStore((s) => s.activeChildId);
  const { isLoading: isRoleLoading } = useRequireCanWrite(activeChildId, session?.user.id ?? null);

  const accent = type ? EventColors[type] : colors.primary;

  // ── Shared state ──────────────────────────────────────────────────────────
  const [time, setTime] = useState(new Date());
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Nappy
  const [nappyType, setNappyType] = useState<NappyMetadata['nappyType']>('wet');

  // Meal
  const [mealType, setMealType] = useState<MealMetadata['mealType']>('bottle');
  const [amount, setAmount] = useState('');
  const [food, setFood] = useState('');

  // ── Sleep-specific state ──────────────────────────────────────────────────
  type SleepMode = 'loading' | 'new' | 'wakeup';
  const [sleepMode, setSleepMode] = useState<SleepMode>('loading');
  const [ongoingSleep, setOngoingSleep] = useState<DailyEvent | null>(null);
  const [sleepStart, setSleepStart] = useState(new Date());
  const [sleepEnd, setSleepEnd] = useState(new Date());
  const [elapsedLabel, setElapsedLabel] = useState('');

  // Fetch last sleep event to determine mode
  useEffect(() => {
    if (type !== 'sleep' || !activeChildId) return;
    getLastEventByType(activeChildId, 'sleep')
      .then((last) => {
        if (last && !(last.metadata as SleepMetadata)?.sleepEnd) {
          // Ongoing sleep found — enter wake-up mode
          setOngoingSleep(last);
          setSleepStart(new Date(last.occurred_at));
          setSleepEnd(new Date());
          setSleepMode('wakeup');
        } else {
          setSleepMode('new');
        }
      })
      .catch(() => setSleepMode('new'));
  }, [type, activeChildId]);

  // Elapsed time ticker (updates every minute while sleeping)
  useEffect(() => {
    if (!ongoingSleep) return;
    const calc = () => {
      const mins = differenceInMinutes(new Date(), new Date(ongoingSleep.occurred_at));
      if (mins < 1) { setElapsedLabel('just now'); return; }
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      setElapsedLabel(h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`);
    };
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, [ongoingSleep]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!activeChildId || !session?.user.id || !type) return;
    setIsLoading(true);

    try {
      let saved: DailyEvent | null = null;

      if (type === 'nappy') {
        saved = await logEvent({
          childId: activeChildId,
          type,
          occurredAt: time,
          notes: notes.trim() || undefined,
          metadata: { nappyType },
          userId: session.user.id,
        });
      } else if (type === 'meal') {
        saved = await logEvent({
          childId: activeChildId,
          type,
          occurredAt: time,
          notes: notes.trim() || undefined,
          metadata: {
            mealType,
            ...(amount ? { amountMl: parseInt(amount, 10) } : {}),
            ...(food ? { food } : {}),
          },
          userId: session.user.id,
        });
      } else if (type === 'sleep') {
        if (sleepMode === 'wakeup' && ongoingSleep) {
          if (sleepEnd <= sleepStart) {
            Alert.alert('Invalid time', 'Wake-up time must be after sleep start time.');
            setIsLoading(false);
            return;
          }
          saved = await updateEvent(ongoingSleep.id, {
            occurred_at: sleepStart.toISOString(),
            metadata: { sleepEnd: sleepEnd.toISOString() } as SleepMetadata,
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          });
        } else if (sleepMode === 'new') {
          saved = await logEvent({
            childId: activeChildId,
            type: 'sleep',
            occurredAt: sleepStart,
            notes: notes.trim() || undefined,
            metadata: {},
            userId: session.user.id,
          });
        }
      }

      if (saved) {
        useLogConfirmationStore.getState().confirmLog(saved);
      }
      router.back();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save event.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!type) return null;

  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const typeEmoji = type === 'nappy' ? '👶' : type === 'meal' ? '🍼' : '😴';
  const isSleepLoading = type === 'sleep' && sleepMode === 'loading';

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={[styles.accentHeader, { backgroundColor: accent }]}>
          <Text style={styles.headerEmoji}>{typeEmoji}</Text>
          <Text style={[styles.headerTitle, { fontFamily: Fonts!.rounded }]}>
            {type === 'sleep'
              ? sleepMode === 'wakeup' ? 'Log wake-up' : 'Log sleep'
              : `Log ${typeLabel}`}
          </Text>
        </View>

        {isSleepLoading ? (
          <View style={styles.sleepLoadingContainer}>
            <ActivityIndicator color={accent} />
          </View>
        ) : (
          <View style={styles.fields}>

            {/* ── Nappy / Meal time picker ── */}
            {type !== 'sleep' && (
              <View>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>Time</Text>
                {Platform.OS === 'ios' ? (
                  <DateTimePicker
                    value={time}
                    mode="time"
                    display="spinner"
                    onChange={(_, d) => d && setTime(d)}
                    themeVariant={scheme}
                    style={styles.iosPicker}
                  />
                ) : (
                  <Pressable
                    style={[styles.androidTimeButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                    onPress={() => setShowAndroidPicker(true)}>
                    <Text style={[styles.androidTimeText, { color: colors.text }]}>
                      🕐 {format(time, 'h:mm a')}
                    </Text>
                    <Text style={[styles.androidTimeHint, { color: colors.muted }]}>Tap to change</Text>
                  </Pressable>
                )}
                {showAndroidPicker && Platform.OS === 'android' && (
                  <DateTimePicker
                    value={time}
                    mode="time"
                    display="default"
                    onChange={(_, d) => { setShowAndroidPicker(false); if (d) setTime(d); }}
                  />
                )}
              </View>
            )}

            {/* ── Sleep UI ── */}
            {type === 'sleep' && (
              <>
                {/* Currently sleeping banner */}
                {sleepMode === 'wakeup' && (
                  <View style={[styles.sleepingBanner, { backgroundColor: accent + '15', borderColor: accent + '50' }]}>
                    <Text style={styles.sleepingEmoji}>😴</Text>
                    <View style={styles.sleepingInfo}>
                      <Text style={[styles.sleepingTitle, { color: accent, fontFamily: Fonts!.rounded }]}>
                        Currently sleeping
                      </Text>
                      {elapsedLabel ? (
                        <Text style={[styles.sleepingElapsed, { color: colors.muted }]}>
                          {elapsedLabel} elapsed
                        </Text>
                      ) : null}
                    </View>
                  </View>
                )}

                {/* Sleep start time */}
                <TimePicker
                  label={sleepMode === 'wakeup' ? 'Sleep start' : 'Fell asleep at'}
                  value={sleepStart}
                  onChange={setSleepStart}
                  scheme={scheme}
                  colors={colors}
                  accent={accent}
                />

                {/* Wake-up time — only in wake-up mode */}
                {sleepMode === 'wakeup' && (
                  <TimePicker
                    label="Woke up at"
                    value={sleepEnd}
                    onChange={setSleepEnd}
                    scheme={scheme}
                    colors={colors}
                    accent={accent}
                  />
                )}
              </>
            )}

            {/* ── Nappy type ── */}
            {type === 'nappy' && (
              <View>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>Type</Text>
                <View style={styles.optionRow}>
                  {NAPPY_TYPES.map((t) => (
                    <Pressable
                      key={t}
                      style={[styles.optionChip, { backgroundColor: nappyType === t ? accent : colors.inputBackground }]}
                      onPress={() => setNappyType(t)}>
                      <Text style={[styles.optionText, { color: nappyType === t ? '#fff' : colors.text }]}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* ── Meal type ── */}
            {type === 'meal' && (
              <>
                <View>
                  <Text style={[styles.fieldLabel, { color: colors.muted }]}>Meal type</Text>
                  <View style={styles.optionRow}>
                    {MEAL_TYPES.map((t) => (
                      <Pressable
                        key={t}
                        style={[styles.optionChip, { backgroundColor: mealType === t ? accent : colors.inputBackground }]}
                        onPress={() => setMealType(t)}>
                        <Text style={[styles.optionText, { color: mealType === t ? '#fff' : colors.text }]}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                {(mealType === 'bottle' || mealType === 'breast') && (
                  <View>
                    <Text style={[styles.fieldLabel, { color: colors.muted }]}>Amount (ml)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                      placeholder="e.g. 120"
                      placeholderTextColor={colors.muted}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="numeric"
                    />
                  </View>
                )}
                {mealType === 'solid' && (
                  <View>
                    <Text style={[styles.fieldLabel, { color: colors.muted }]}>Food</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                      placeholder="e.g. Pureed carrot"
                      placeholderTextColor={colors.muted}
                      value={food}
                      onChangeText={setFood}
                    />
                  </View>
                )}
              </>
            )}

            {/* Notes */}
            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                placeholder="Any observations..."
                placeholderTextColor={colors.muted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        )}

        <Pressable
          style={[styles.button, { backgroundColor: accent }, (isLoading || isSleepLoading) && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={isLoading || isSleepLoading}>
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>
                {type === 'sleep' && sleepMode === 'wakeup' ? 'Save wake-up' : 'Save'}
              </Text>
          }
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingBottom: 40 },
  accentHeader: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  headerEmoji: { fontSize: 48 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  sleepLoadingContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  fields: {
    padding: Spacing.lg,
    gap: Spacing.lg,
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
  androidTimeButton: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  androidTimeText: { fontSize: 16, fontWeight: '600' },
  androidTimeHint: { fontSize: 13 },
  sleepingBanner: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  sleepingEmoji: { fontSize: 32 },
  sleepingInfo: { flex: 1, gap: 2 },
  sleepingTitle: { fontSize: 16, fontWeight: '700' },
  sleepingElapsed: { fontSize: 14 },
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
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  button: {
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
