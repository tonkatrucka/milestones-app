import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { BreastSide } from '@/lib/database.types';
import { Radius, Spacing } from '@/constants/theme';
import { formatBreastSide } from '@/lib/meal-format';
import {
  formatBreastfeedingElapsed,
  getActiveBreastFeedingSession,
  startBreastFeedingSession,
  stopBreastFeedingSession,
} from '@/services/breast-feeding-timer';
import { useBreastFeedingStore } from '@/store/breast-feeding-store';

const DURATION_MAX = 60;
const AMOUNT_MAX = 500;
const THUMB = 22;
const TRACK_H = 6;

type BreastInputMode = 'duration' | 'amount';

export interface BreastFeedValues {
  side: BreastSide | null;
  mode: BreastInputMode;
  durationMins: number;
  amountMl: number;
}

function MinuteSlider({
  value,
  max,
  accent,
  trackColor,
  onChange,
}: {
  value: number;
  max: number;
  accent: string;
  trackColor: string;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<View>(null);
  const origin = useRef({ x: 0, w: 0 });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const fromPageX = (pageX: number) => {
    const { x, w } = origin.current;
    if (w === 0) return value;
    const ratio = Math.max(0, Math.min(1, (pageX - x) / w));
    return Math.max(1, Math.round(ratio * max));
  };

  const pct = `${Math.round((value / max) * 100)}%`;

  return (
    <View
      ref={trackRef}
      style={styles.sliderHit}
      onLayout={() =>
        trackRef.current?.measureInWindow((x, _y, w) => {
          origin.current = { x, w };
        })
      }
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => onChangeRef.current(fromPageX(e.nativeEvent.pageX))}
      onResponderMove={(e) => onChangeRef.current(fromPageX(e.nativeEvent.pageX))}>
      <View style={[styles.sliderTrack, { backgroundColor: trackColor }]} />
      <View style={[styles.sliderFill, { width: pct as `${number}%`, backgroundColor: accent }]} />
      <View style={[styles.sliderThumb, { left: pct as `${number}%`, backgroundColor: accent }]} />
    </View>
  );
}

export interface BreastFeedControlsProps {
  accent: string;
  borderColor: string;
  mutedColor: string;
  inputBackground: string;
  textColor: string;
  childId: string | null;
  occurredAt: Date;
  onLog?: (meta: Record<string, unknown>, occurredAt?: Date) => void;
  enableTimer?: boolean;
  showLogActions?: boolean;
  values?: BreastFeedValues;
  onValuesChange?: (values: BreastFeedValues) => void;
}

const SIDE_OPTIONS: { key: BreastSide; label: string }[] = [
  { key: 'left', label: 'Left' },
  { key: 'right', label: 'Right' },
  { key: 'both', label: 'Both' },
];

export function BreastFeedControls({
  accent,
  borderColor,
  mutedColor,
  inputBackground,
  textColor,
  childId,
  occurredAt,
  onLog,
  enableTimer = true,
  showLogActions = true,
  values: controlledValues,
  onValuesChange,
}: BreastFeedControlsProps) {
  const session = useBreastFeedingStore((s) => s.session);
  const activeSession =
    childId && session?.childId === childId ? session : null;

  const [internalSide, setInternalSide] = useState<BreastSide | null>(null);
  const [internalMode, setInternalMode] = useState<BreastInputMode>('duration');
  const [internalDuration, setInternalDuration] = useState(10);
  const [internalAmount, setInternalAmount] = useState(120);

  const side = controlledValues?.side ?? internalSide;
  const mode = controlledValues?.mode ?? internalMode;
  const durationMins = controlledValues?.durationMins ?? internalDuration;
  const amountMl = controlledValues?.amountMl ?? internalAmount;

  const patchValues = (patch: Partial<BreastFeedValues>) => {
    const next: BreastFeedValues = {
      side: patch.side !== undefined ? patch.side : side,
      mode: patch.mode !== undefined ? patch.mode : mode,
      durationMins: patch.durationMins !== undefined ? patch.durationMins : durationMins,
      amountMl: patch.amountMl !== undefined ? patch.amountMl : amountMl,
    };
    if (onValuesChange) onValuesChange(next);
    else {
      if (patch.side !== undefined) setInternalSide(patch.side);
      if (patch.mode !== undefined) setInternalMode(patch.mode);
      if (patch.durationMins !== undefined) setInternalDuration(patch.durationMins);
      if (patch.amountMl !== undefined) setInternalAmount(patch.amountMl);
    }
  };

  const setSide = (v: BreastSide) => patchValues({ side: v });
  const setMode = (v: BreastInputMode) => patchValues({ mode: v });
  const setDurationMins = (v: number) => patchValues({ durationMins: v });
  const setAmountMl = (v: number) => patchValues({ amountMl: v });
  const [elapsedLabel, setElapsedLabel] = useState('');

  useEffect(() => {
    if (!activeSession) {
      setElapsedLabel('');
      return;
    }
    const tick = () => setElapsedLabel(formatBreastfeedingElapsed(activeSession.startedAt));
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [activeSession]);

  const requireSide = (): BreastSide | null => {
    if (side) return side;
    Alert.alert('Select side', 'Choose left, right, or both before logging.');
    return null;
  };

  const buildMeta = (pickedSide: BreastSide): Record<string, unknown> => {
    const meta: Record<string, unknown> = { mealType: 'breast', breastSide: pickedSide };
    if (mode === 'duration') meta.durationMins = durationMins;
    else meta.amountMl = amountMl;
    return meta;
  };

  const handleManualLog = () => {
    if (!onLog) return;
    const pickedSide = requireSide();
    if (!pickedSide) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLog(buildMeta(pickedSide), occurredAt);
  };

  const handleStartTimer = async () => {
    if (!childId) return;
    const pickedSide = requireSide();
    if (!pickedSide) return;

    const existing = getActiveBreastFeedingSession(childId);
    if (existing) {
      Alert.alert('Timer already running', 'Stop the current breastfeeding timer first.');
      return;
    }

    const result = await startBreastFeedingSession(childId, pickedSide);
    if (!result.ok) {
      Alert.alert(
        'Notifications needed',
        'Allow notifications so you can see the breastfeeding timer while using other apps.',
      );
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleStopTimer = async () => {
    const result = await stopBreastFeedingSession();
    if (!result || !onLog) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLog(
      {
        mealType: 'breast',
        breastSide: result.side,
        durationMins: result.durationMins,
      },
      result.startedAt,
    );
  };

  const timerSide = activeSession ? formatBreastSide(activeSession.side) : null;

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: mutedColor }]}>Side</Text>
      <View style={styles.sideRow}>
        {SIDE_OPTIONS.map((opt) => {
          const isActive = side === opt.key;
          const isTimerSide = activeSession?.side === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[
                styles.sideChip,
                { borderColor: accent },
                (isActive || isTimerSide) && { backgroundColor: accent },
              ]}
              disabled={!!activeSession}
              onPress={() => setSide(opt.key)}>
              <Text style={[styles.sideChipText, { color: isActive || isTimerSide ? '#fff' : accent }]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!activeSession && (
        <>
          <View style={styles.modeRow}>
            {(['duration', 'amount'] as BreastInputMode[]).map((m) => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  style={[
                    styles.modeChip,
                    { borderColor: accent, backgroundColor: active ? accent : inputBackground },
                  ]}
                  onPress={() => setMode(m)}>
                  <Text style={[styles.modeChipText, { color: active ? '#fff' : textColor }]}>
                    {m === 'duration' ? 'Duration' : 'Amount (ml)'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {mode === 'duration' ? (
            <View style={styles.sliderBlock}>
              <View style={styles.sliderRow}>
                <Text style={[styles.heading, { color: mutedColor }]}>Duration</Text>
                <Text style={[styles.valueText, { color: accent }]}>{durationMins} min</Text>
              </View>
              <MinuteSlider
                value={durationMins}
                max={DURATION_MAX}
                accent={accent}
                trackColor={borderColor}
                onChange={setDurationMins}
              />
            </View>
          ) : (
            <View style={styles.sliderBlock}>
              <View style={styles.sliderRow}>
                <Text style={[styles.heading, { color: mutedColor }]}>Amount</Text>
                <Text style={[styles.valueText, { color: accent }]}>{amountMl} ml</Text>
              </View>
              <MinuteSlider
                value={amountMl}
                max={AMOUNT_MAX}
                accent={accent}
                trackColor={borderColor}
                onChange={setAmountMl}
              />
            </View>
          )}
        </>
      )}

      {enableTimer && Platform.OS !== 'web' && (
        <View style={[styles.timerBlock, { borderColor: borderColor }]}>
          {activeSession ? (
            <>
              <Text style={[styles.timerElapsed, { color: accent }]}>{elapsedLabel || '0m'}</Text>
              <Text style={[styles.timerCaption, { color: mutedColor }]}>
                Feeding · {timerSide}
              </Text>
              <Pressable
                style={[styles.timerBtn, { backgroundColor: accent }]}
                onPress={() => void handleStopTimer()}>
                <Text style={styles.timerBtnText}>Stop & log</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[styles.timerCaption, { color: mutedColor }]}>Live timer</Text>
              <Pressable
                style={[styles.timerBtn, styles.timerBtnOutline, { borderColor: accent }]}
                onPress={() => void handleStartTimer()}>
                <Text style={[styles.timerBtnText, { color: accent }]}>Start timer</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {!activeSession && showLogActions && onLog && (
        <View style={styles.logRow}>
          <Pressable
            style={[styles.logBtn, styles.logBtnSecondary, { borderColor: accent }]}
            onPress={() =>
              onLog({ mealType: 'breast', ...(side ? { breastSide: side } : {}) }, occurredAt)
            }>
            <Text style={[styles.logBtnText, { color: accent }]}>No details</Text>
          </Pressable>
          <Pressable
            style={[styles.logBtn, styles.logBtnPrimary, { backgroundColor: accent }]}
            onPress={handleManualLog}>
            <Text style={styles.logBtnText}>
              Log {mode === 'duration' ? `${durationMins} min` : `${amountMl} ml`}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  heading: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sideRow: { flexDirection: 'row', gap: 6 },
  sideChip: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingVertical: 6,
    alignItems: 'center',
  },
  sideChipText: { fontSize: 13, fontWeight: '600' },
  modeRow: { flexDirection: 'row', gap: Spacing.sm },
  modeChip: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingVertical: 7,
    alignItems: 'center',
  },
  modeChipText: { fontSize: 12, fontWeight: '600' },
  sliderBlock: { gap: Spacing.xs },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valueText: { fontSize: 15, fontWeight: '700' },
  sliderHit: {
    height: THUMB + 8,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
  },
  sliderThumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    marginLeft: -(THUMB / 2),
    top: (THUMB + 8 - THUMB) / 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  timerBlock: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
  },
  timerElapsed: { fontSize: 28, fontWeight: '700' },
  timerCaption: { fontSize: 12, fontWeight: '600' },
  timerBtn: {
    borderRadius: Radius.full,
    paddingVertical: 9,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  timerBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  timerBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  logRow: { flexDirection: 'row', gap: Spacing.sm },
  logBtn: {
    flex: 1,
    borderRadius: Radius.full,
    paddingVertical: 9,
    alignItems: 'center',
  },
  logBtnPrimary: {},
  logBtnSecondary: { borderWidth: 1.5, backgroundColor: 'transparent' },
  logBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
