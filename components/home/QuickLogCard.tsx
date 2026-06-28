import { useRef, useState, useEffect, type RefObject } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { differenceInMinutes, format } from 'date-fns';
import { Colors, EventColors, Fonts, Radius, Spacing } from '@/constants/theme';
import { TimeSince } from '@/components/shared/TimeSince';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { EVENT_LABELS, QUICK_LOG_EMOJIS } from '@/lib/event-display';
import type { DailyEvent, EventType } from '@/lib/database.types';
import type { LayoutRect } from '@/store/log-confirmation-store';
import { BreastFeedControls } from '@/components/meals/BreastFeedControls';
import { formatBreastfeedingElapsed } from '@/services/breast-feeding-timer';
import { formatSessionElapsed } from '@/lib/session-elapsed';
import { useBreastFeedingStore } from '@/store/breast-feeding-store';
import { usePendingMealQuickLogStore } from '@/store/pending-meal-quick-log-store';
import { usePendingSleepQuickLogStore } from '@/store/pending-sleep-quick-log-store';

const SLIDER_MAX = 500;
const THUMB = 22;
const TRACK_H = 6;

/* ── Amount slider ────────────────────────────────────────────────── */
function AmountSlider({
  value,
  accent,
  trackColor,
  onChange,
}: {
  value: number;
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
    return Math.round((ratio * SLIDER_MAX) / 10) * 10;
  };

  const pct = `${Math.round((value / SLIDER_MAX) * 100)}%`;

  return (
    <View
      ref={trackRef}
      style={tipStyles.sliderHit}
      onLayout={() =>
        trackRef.current?.measureInWindow((x, _y, w) => { origin.current = { x, w }; })
      }
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => onChangeRef.current(fromPageX(e.nativeEvent.pageX))}
      onResponderMove={(e) => onChangeRef.current(fromPageX(e.nativeEvent.pageX))}>
      {/* Track background */}
      <View style={[tipStyles.sliderTrack, { backgroundColor: trackColor }]} />
      {/* Filled portion */}
      <View style={[tipStyles.sliderFill, { width: pct as any, backgroundColor: accent }]} />
      {/* Thumb */}
      <View style={[tipStyles.sliderThumb, { left: pct as any, backgroundColor: accent }]} />
    </View>
  );
}

/* ── Shared date + time field for quick-log tooltips ─────────────── */

function mergeDate(base: Date, dateSrc: Date): Date {
  const merged = new Date(base);
  merged.setFullYear(dateSrc.getFullYear(), dateSrc.getMonth(), dateSrc.getDate());
  return merged;
}

function mergeTime(base: Date, timeSrc: Date): Date {
  const merged = new Date(base);
  merged.setHours(timeSrc.getHours(), timeSrc.getMinutes(), 0, 0);
  return merged;
}

function DateTimeField({
  label,
  value,
  accent,
  mutedColor,
  activeDate,
  activeTime,
  onDatePress,
  onTimePress,
}: {
  label: string;
  value: Date;
  accent: string;
  mutedColor: string;
  activeDate: boolean;
  activeTime: boolean;
  onDatePress: () => void;
  onTimePress: () => void;
}) {
  return (
    <View style={tipStyles.timeRow}>
      <Text style={[tipStyles.heading, { color: mutedColor }]}>{label}</Text>
      <View style={tipStyles.dateTimeChips}>
        <Pressable
          style={[
            tipStyles.timeChip,
            { borderColor: accent },
            activeDate && { backgroundColor: accent + '18' },
          ]}
          onPress={onDatePress}>
          <Text style={[tipStyles.timeChipText, { color: accent }]}>{format(value, 'd MMM')}</Text>
          <Ionicons name="calendar-outline" size={13} color={accent} />
        </Pressable>
        <Pressable
          style={[
            tipStyles.timeChip,
            { borderColor: accent },
            activeTime && { backgroundColor: accent + '18' },
          ]}
          onPress={onTimePress}>
          <Text style={[tipStyles.timeChipText, { color: accent }]}>{format(value, 'h:mm a')}</Text>
          <Ionicons name="pencil-outline" size={13} color={accent} />
        </Pressable>
      </View>
    </View>
  );
}

function EventWhenField({
  value,
  onChange,
  accent,
  mutedColor,
  label = 'When',
}: {
  value: Date;
  onChange: (date: Date) => void;
  accent: string;
  mutedColor: string;
  label?: string;
}) {
  const scheme = useColorScheme() ?? 'light';
  const [activePicker, setActivePicker] = useState<'date' | 'time' | null>(null);

  const togglePicker = (field: 'date' | 'time') =>
    setActivePicker((prev) => (prev === field ? null : field));

  const onPickerChange = (_e: unknown, date?: Date) => {
    if (Platform.OS === 'android') setActivePicker(null);
    if (!date || !activePicker) return;
    onChange(activePicker === 'date' ? mergeDate(value, date) : mergeTime(value, date));
  };

  return (
    <>
      <DateTimeField
        label={label}
        value={value}
        accent={accent}
        mutedColor={mutedColor}
        activeDate={activePicker === 'date'}
        activeTime={activePicker === 'time'}
        onDatePress={() => togglePicker('date')}
        onTimePress={() => togglePicker('time')}
      />
      {activePicker && (
        <DateTimePicker
          value={value}
          mode={activePicker}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          themeVariant={scheme}
          onChange={onPickerChange}
        />
      )}
    </>
  );
}

/* ── Meal tooltip (two-step: type → details) ─────────────────────── */
function MealTooltipContent({
  accent,
  borderColor,
  mutedColor,
  inputBackground,
  textColor,
  childId,
  onLog,
}: {
  accent: string;
  borderColor: string;
  mutedColor: string;
  inputBackground: string;
  textColor: string;
  childId: string | null;
  onLog: (meta: Record<string, unknown>, occurredAt?: Date) => void;
}) {
  const [mealType, setMealType] = useState<string | null>(null);
  const [amount, setAmount] = useState(120);
  const [food, setFood] = useState('');
  const [occurredAt, setOccurredAt] = useState(() => new Date());

  // Drag-highlight state — same pattern as QuickChipGrid
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const gridRef = useRef<View>(null);
  const origin = useRef({ x: 0, w: 0 });
  const dragRef = useRef<number | null>(null);
  const onLogRef = useRef(onLog);
  onLogRef.current = onLog;

  const hit = (pageX: number): number | null => {
    const { x, w } = origin.current;
    if (w === 0) return null;
    const N = MEAL_TYPES.length;
    const GAP = 6;
    const chipW = (w - (N - 1) * GAP) / N;
    const offset = pageX - x;
    if (offset < 0 || offset > w) return null;
    const i = Math.floor(offset / (chipW + GAP));
    return i >= 0 && i < N ? i : null;
  };

  const activateDrag = (i: number | null) => {
    if (i === dragRef.current) return;
    dragRef.current = i;
    setDragIdx(i);
    if (i !== null) Haptics.selectionAsync().catch(() => {});
  };

  const needsSlider = mealType === 'bottle';
  const needsBreastControls = mealType === 'breast';
  const needsFoodInput = mealType === 'solid' || mealType === 'snack';

  const handleChip = (v: string) => {
    setMealType((prev) => (prev === v ? null : v));
    setFood('');
  };

  return (
    <View style={tipStyles.inner}>
      <EventWhenField
        value={occurredAt}
        onChange={setOccurredAt}
        accent={accent}
        mutedColor={mutedColor}
      />

      <Text style={[tipStyles.heading, { color: mutedColor }]}>Meal type</Text>

      {/* Chip grid with drag-highlight — mirrors QuickChipGrid behaviour */}
      <View
        ref={gridRef}
        style={tipStyles.grid}
        onLayout={() =>
          gridRef.current?.measureInWindow((x, _y, w) => { origin.current = { x, w }; })
        }
        onStartShouldSetResponder={() => false}
        onMoveShouldSetResponder={() => true}
        onResponderMove={(e) => activateDrag(hit(e.nativeEvent.pageX))}
        onResponderRelease={(e) => {
          const i = hit(e.nativeEvent.pageX);
          dragRef.current = null;
          setDragIdx(null);
          if (i !== null) handleChip(MEAL_TYPES[i].toLowerCase());
        }}
        onResponderTerminate={() => { dragRef.current = null; setDragIdx(null); }}>
        {MEAL_TYPES.map((label, i) => {
          const v = label.toLowerCase();
          const isSelected = mealType === v;
          const isDragging = dragIdx === i;
          const isActive = isSelected || isDragging;
          return (
            <Pressable
              key={label}
              style={[
                tipStyles.chip,
                { borderColor: accent, backgroundColor: isActive ? accent : 'transparent' },
              ]}
              onPressIn={() => {
                dragRef.current = i;
                setDragIdx(i);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              onPress={() => handleChip(v)}>
              <Text style={[tipStyles.chipText, { color: isActive ? '#fff' : accent }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {needsBreastControls && (
        <BreastFeedControls
          accent={accent}
          borderColor={borderColor}
          mutedColor={mutedColor}
          inputBackground={inputBackground}
          textColor={textColor}
          childId={childId}
          occurredAt={occurredAt}
          onLog={onLog}
        />
      )}

      {needsSlider && (
        <View style={tipStyles.sliderSection}>
          <View style={tipStyles.sliderRow}>
            <Text style={[tipStyles.heading, { color: mutedColor }]}>Amount</Text>
            <Text style={[tipStyles.amountVal, { color: accent }]}>{amount} ml</Text>
          </View>
          <AmountSlider
            value={amount}
            accent={accent}
            trackColor={borderColor}
            onChange={setAmount}
          />
          <View style={tipStyles.logRow}>
            <Pressable
              style={[tipStyles.logBtn, tipStyles.logBtnSecondary, { borderColor: accent }]}
              onPress={() => onLog({ mealType }, occurredAt)}>
              <Text style={[tipStyles.logBtnText, { color: accent }]}>No Amount</Text>
            </Pressable>
            <Pressable
              style={[tipStyles.logBtn, tipStyles.logBtnPrimary, { backgroundColor: accent }]}
              onPress={() => onLog({ mealType, amountMl: amount }, occurredAt)}>
              <Text style={tipStyles.logBtnText}>Log {amount} ml</Text>
            </Pressable>
          </View>
        </View>
      )}

      {needsFoodInput && (
        <View style={tipStyles.sliderSection}>
          <Text style={[tipStyles.heading, { color: mutedColor }]}>Food</Text>
          <TextInput
            style={[
              tipStyles.foodInput,
              { backgroundColor: inputBackground, color: textColor, borderColor },
            ]}
            placeholder={mealType === 'snack' ? 'e.g. Banana' : 'e.g. Pureed carrot'}
            placeholderTextColor={mutedColor}
            value={food}
            onChangeText={setFood}
          />
          <Pressable
            style={[tipStyles.logBtn, tipStyles.logBtnPrimary, { backgroundColor: accent }]}
            onPress={() =>
              onLog(
                {
                  mealType,
                  ...(food.trim() ? { food: food.trim() } : {}),
                },
                occurredAt,
              )
            }>
            <Text style={tipStyles.logBtnText}>
              Log {mealType === 'snack' ? 'snack' : 'meal'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/* ── Sleep tooltip (pre-filled editable date + time) ─────────────── */

type SleepPickerField = 'startDate' | 'startTime' | 'endDate' | 'endTime' | null;

function SleepTooltipContent({
  isSleeping,
  sleepStart,
  accent,
  mutedColor,
  onStart,
  onWakeUp,
}: {
  isSleeping: boolean;
  sleepStart?: Date;
  accent: string;
  mutedColor: string;
  onStart: (at: Date) => void;
  onWakeUp: (startAt: Date, endAt: Date) => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const [startTime, setStartTime] = useState(() => sleepStart ?? new Date());
  const [endTime, setEndTime] = useState(() => new Date());
  const [activePicker, setActivePicker] = useState<SleepPickerField>(null);

  const togglePicker = (field: SleepPickerField) =>
    setActivePicker((prev) => (prev === field ? null : field));

  const pickerValue =
    activePicker === 'startDate' || activePicker === 'startTime' ? startTime : endTime;
  const pickerMode = activePicker?.endsWith('Date') ? 'date' : 'time';

  const onPickerChange = (_e: unknown, date?: Date) => {
    if (Platform.OS === 'android') setActivePicker(null);
    if (!date || !activePicker) return;

    if (activePicker === 'startDate') setStartTime((prev) => mergeDate(prev, date));
    else if (activePicker === 'startTime') setStartTime((prev) => mergeTime(prev, date));
    else if (activePicker === 'endDate') setEndTime((prev) => mergeDate(prev, date));
    else if (activePicker === 'endTime') setEndTime((prev) => mergeTime(prev, date));
  };

  const handleWakeUp = () => {
    if (endTime <= startTime) {
      Alert.alert('Invalid time', 'Wake-up must be after sleep start.');
      return;
    }
    onWakeUp(startTime, endTime);
  };

  return (
    <View style={tipStyles.inner}>
      {isSleeping ? (
        <View style={tipStyles.sleepBlock}>
          <View style={tipStyles.sleepDurationCol}>
            {(() => {
              const mins = Math.max(0, differenceInMinutes(endTime, startTime));
              const label = mins >= 60
                ? `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ''}`
                : `${mins}m`;
              return (
                <>
                  <Text style={[tipStyles.sleepDurationVal, { color: accent }]}>{label}</Text>
                  <Text style={[tipStyles.heading, { color: mutedColor }]}>duration</Text>
                </>
              );
            })()}
          </View>
          <View style={tipStyles.sleepTimeRows}>
            <DateTimeField
              label="Start"
              value={startTime}
              accent={accent}
              mutedColor={mutedColor}
              activeDate={activePicker === 'startDate'}
              activeTime={activePicker === 'startTime'}
              onDatePress={() => togglePicker('startDate')}
              onTimePress={() => togglePicker('startTime')}
            />
            <DateTimeField
              label="End"
              value={endTime}
              accent={accent}
              mutedColor={mutedColor}
              activeDate={activePicker === 'endDate'}
              activeTime={activePicker === 'endTime'}
              onDatePress={() => togglePicker('endDate')}
              onTimePress={() => togglePicker('endTime')}
            />
          </View>
        </View>
      ) : (
        <DateTimeField
          label="Start"
          value={startTime}
          accent={accent}
          mutedColor={mutedColor}
          activeDate={activePicker === 'startDate'}
          activeTime={activePicker === 'startTime'}
          onDatePress={() => togglePicker('startDate')}
          onTimePress={() => togglePicker('startTime')}
        />
      )}

      {activePicker && (
        <DateTimePicker
          value={pickerValue}
          mode={pickerMode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          themeVariant={scheme}
          onChange={onPickerChange}
        />
      )}

      {isSleeping ? (
        <Pressable
          style={[tipStyles.sleepBtn, { backgroundColor: accent }]}
          onPress={handleWakeUp}
          android_ripple={{ color: '#fff4' }}>
          <Text style={tipStyles.sleepBtnText}>☀️  Log wake-up</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[tipStyles.sleepBtn, { backgroundColor: accent }]}
          onPress={() => onStart(startTime)}
          android_ripple={{ color: '#fff4' }}>
          <Text style={tipStyles.sleepBtnText}>😴  Start sleep</Text>
        </Pressable>
      )}
    </View>
  );
}

const SLEEP_STATUS_EMOJIS = { awake: '😊', asleep: '😴' } as const;

const NAPPY_TYPES = ['Wet', 'Dirty', 'Both', 'Dry'] as const;
const MEAL_TYPES = ['Breast', 'Bottle', 'Solid', 'Snack'] as const;

/* ── Chip row ─────────────────────────────────────────────────────── */
function QuickChipGrid({
  options,
  accent,
  onSelect,
}: {
  options: readonly string[];
  accent: string;
  onSelect: (value: string) => void;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const gridRef = useRef<View>(null);
  const origin = useRef({ x: 0, w: 0 });
  // Ref mirrors state so responder callbacks never read stale closures.
  const activeRef = useRef<number | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const hit = (pageX: number): number | null => {
    const { x, w } = origin.current;
    if (w === 0) return null;
    const N = options.length;
    const GAP = 6;
    const chipW = (w - (N - 1) * GAP) / N;
    const offset = pageX - x;
    if (offset < 0 || offset > w) return null;
    const i = Math.floor(offset / (chipW + GAP));
    return i >= 0 && i < N ? i : null;
  };

  const activate = (i: number | null) => {
    if (i === activeRef.current) return;
    activeRef.current = i;
    setActiveIdx(i);
    if (i !== null) Haptics.selectionAsync().catch(() => {});
  };

  const commit = (pageX: number) => {
    const i = hit(pageX);
    activeRef.current = null;
    setActiveIdx(null);
    if (i !== null) onSelectRef.current(options[i].toLowerCase());
  };

  return (
    <View
      ref={gridRef}
      style={tipStyles.grid}
      onLayout={() =>
        gridRef.current?.measureInWindow((x, _y, w) => { origin.current = { x, w }; })
      }
      // Don't claim the initial touch — let the chip Pressable fire onPressIn.
      onStartShouldSetResponder={() => false}
      // Steal the responder once the finger moves so we can track drag position.
      onMoveShouldSetResponder={() => true}
      onResponderMove={(e) => activate(hit(e.nativeEvent.pageX))}
      onResponderRelease={(e) => commit(e.nativeEvent.pageX)}
      onResponderTerminate={() => { activeRef.current = null; setActiveIdx(null); }}
    >
      {options.map((label, i) => {
        const isActive = activeIdx === i;
        return (
          <Pressable
            key={label}
            style={[
              tipStyles.chip,
              { borderColor: accent, backgroundColor: isActive ? accent : 'transparent' },
            ]}
            onPressIn={() => {
              // Set initial highlight; do NOT clear in onPressOut because the
              // grid responder may have taken over for drag tracking.
              activeRef.current = i;
              setActiveIdx(i);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            onPress={() => {
              // Simple tap (no drag): commit and clear.
              activeRef.current = null;
              setActiveIdx(null);
              onSelectRef.current(label.toLowerCase());
            }}>
            <Text style={[tipStyles.chipText, { color: isActive ? '#fff' : accent }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function NappyTooltipContent({
  accent,
  mutedColor,
  onLog,
}: {
  accent: string;
  mutedColor: string;
  onLog: (meta: Record<string, unknown>, occurredAt?: Date) => void;
}) {
  const [occurredAt, setOccurredAt] = useState(() => new Date());

  return (
    <View style={tipStyles.inner}>
      <EventWhenField
        value={occurredAt}
        onChange={setOccurredAt}
        accent={accent}
        mutedColor={mutedColor}
      />
      <Text style={[tipStyles.heading, { color: mutedColor }]}>Nappy type</Text>
      <QuickChipGrid
        options={NAPPY_TYPES}
        accent={accent}
        onSelect={(v) => onLog({ nappyType: v }, occurredAt)}
      />
    </View>
  );
}

interface QuickLogCardProps {
  type: EventType;
  childId: string | null;
  lastEvent: DailyEvent | null;
  readOnly?: boolean;
  /** Called with the event's metadata (and optional custom time) when the user confirms. */
  onLog: (metadata: Record<string, unknown>, occurredAt?: Date, origin?: LayoutRect) => void;
  /** Called when the user logs a wake-up. endAt = wake time; startAt = sleep start (may be edited). */
  onSleepWakeUp: (endAt: Date, startAt?: Date, origin?: LayoutRect) => void;
  onViewDetail: () => void;
}

type CardLayout = { x: number; y: number; width: number; height: number };

export function QuickLogCard({
  type,
  childId,
  lastEvent,
  readOnly = false,
  onLog,
  onSleepWakeUp,
  onViewDetail,
}: QuickLogCardProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const accent = EventColors[type];

  const cardRef = useRef<View>(null);
  const logBtnRef = useRef<View>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [cardLayout, setCardLayout] = useState<CardLayout | null>(null);

  const sleepMeta = type === 'sleep' && lastEvent
    ? (lastEvent.metadata as { sleepEnd?: string })
    : null;
  const isSleeping = type === 'sleep' && lastEvent && !sleepMeta?.sleepEnd;

  const breastSession = useBreastFeedingStore((s) => s.session);
  const isFeeding =
    type === 'meal' && !!childId && breastSession?.childId === childId;

  const [elapsedLabel, setElapsedLabel] = useState('');
  const [feedingLabel, setFeedingLabel] = useState('');
  useEffect(() => {
    if (!isSleeping || !lastEvent) return;
    const tick = () => setElapsedLabel(formatSessionElapsed(lastEvent.occurred_at));
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [isSleeping, lastEvent]);

  useEffect(() => {
    if (!isFeeding || !breastSession) return;
    const tick = () => setFeedingLabel(formatBreastfeedingElapsed(breastSession.startedAt));
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [isFeeding, breastSession]);

  const pendingMealQuickLog = usePendingMealQuickLogStore((s) => s.pending);
  const setPendingMealQuickLog = usePendingMealQuickLogStore((s) => s.setPending);
  const pendingSleepQuickLog = usePendingSleepQuickLogStore((s) => s.pending);
  const setPendingSleepQuickLog = usePendingSleepQuickLogStore((s) => s.setPending);

  const openTooltip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logBtnRef.current?.measureInWindow((x, y, width, height) => {
      setCardLayout({ x, y, width, height });
      setShowTooltip(true);
    });
  };

  useEffect(() => {
    if (!pendingMealQuickLog || type !== 'meal' || readOnly) return;
    setPendingMealQuickLog(false);
    openTooltip();
  }, [pendingMealQuickLog, type, readOnly, setPendingMealQuickLog]);

  useEffect(() => {
    if (!pendingSleepQuickLog || type !== 'sleep' || readOnly) return;
    setPendingSleepQuickLog(false);
    openTooltip();
  }, [pendingSleepQuickLog, type, readOnly, setPendingSleepQuickLog]);

  const closeTooltip = () => setShowTooltip(false);

  const measureCardOrigin = (cb: (origin: LayoutRect) => void) => {
    cardRef.current?.measureInWindow((x, y, width, height) => {
      cb({ x, y, width, height });
    });
  };

  const logAndClose = (metadata: Record<string, unknown>, occurredAt?: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    measureCardOrigin((origin) => {
      onLog(metadata, occurredAt, origin);
      closeTooltip();
    });
  };

  const wakeUpAndClose = (startAt: Date, endAt: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    measureCardOrigin((origin) => {
      onSleepWakeUp(endAt, startAt, origin);
      closeTooltip();
    });
  };

  /* ── Tooltip positioning ───────────────────────────────────────── */
  const { width: SW } = Dimensions.get('window');
  // Wide enough for 4 chips ("Breast", "Bottle", etc.) in one row
  const TOOLTIP_W = SW - 24;
  const tooltipLeft = cardLayout
    ? Math.max(8, Math.min(
        cardLayout.x + (cardLayout.width - TOOLTIP_W) / 2,
        SW - TOOLTIP_W - 8,
      ))
    : 0;
  // Arrow points back up to the centre of the + Log button
  const arrowCentreX = cardLayout
    ? Math.min(
        Math.max(cardLayout.x + cardLayout.width / 2 - tooltipLeft, 16),
        TOOLTIP_W - 16,
      )
    : TOOLTIP_W / 2;

  /* ── Tooltip content ───────────────────────────────────────────── */
  const renderTooltipContent = () => {
    if (type === 'nappy') {
      return (
        <NappyTooltipContent
          accent={accent}
          mutedColor={colors.muted}
          onLog={logAndClose}
        />
      );
    }

    if (type === 'meal') {
      return (
        <MealTooltipContent
          accent={accent}
          borderColor={colors.border}
          mutedColor={colors.muted}
          inputBackground={colors.inputBackground}
          textColor={colors.text}
          childId={childId}
          onLog={logAndClose}
        />
      );
    }

    // Sleep
    return (
      <SleepTooltipContent
        isSleeping={!!isSleeping}
        sleepStart={lastEvent ? new Date(lastEvent.occurred_at) : undefined}
        accent={accent}
        mutedColor={colors.muted}
        onStart={(at) => logAndClose({}, at)}
        onWakeUp={wakeUpAndClose}
      />
    );
  };

  return (
    <>
      {/* Card */}
      <Pressable
        ref={cardRef as RefObject<View>}
        collapsable={false}
        style={[styles.card, { backgroundColor: colors.card }]}
        onPress={readOnly ? undefined : onViewDetail}
        disabled={readOnly}
        android_ripple={readOnly ? undefined : { color: accent + '22' }}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <View style={styles.content}>
          {/* Emoji — sleep shows inline status badge */}
          {type === 'sleep' ? (
            <View style={styles.emojiRow}>
              <Text style={styles.emoji}>
                {isSleeping ? SLEEP_STATUS_EMOJIS.asleep : SLEEP_STATUS_EMOJIS.awake}
              </Text>
              <Text style={[styles.sleepStatus, { color: isSleeping ? accent : colors.muted }]}>
                {isSleeping ? 'Sleeping' : 'Awake'}
              </Text>
            </View>
          ) : type === 'meal' && isFeeding ? (
            <View style={styles.emojiRow}>
              <Text style={styles.emoji}>{QUICK_LOG_EMOJIS.meal}</Text>
              <Text style={[styles.sleepStatus, { color: accent }]}>Feeding</Text>
            </View>
          ) : (
            <Text style={styles.emoji}>{QUICK_LOG_EMOJIS[type]}</Text>
          )}
          <Text style={[styles.label, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            {EVENT_LABELS[type]}
          </Text>
          <View style={styles.infoArea}>
            {lastEvent ? (
              <>
                <Text style={[styles.time, { color: colors.text }]}>
                  {format(new Date(lastEvent.occurred_at), 'h:mm a')}
                </Text>
                {isSleeping ? (
                  <Text style={[styles.elapsed, { color: colors.muted }]}>
                    {elapsedLabel || 'just now'}
                  </Text>
                ) : isFeeding ? (
                  <Text style={[styles.elapsed, { color: colors.muted }]}>
                    {feedingLabel || 'just now'}
                  </Text>
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
          {!readOnly && (
            <Pressable
              ref={logBtnRef as RefObject<View>}
              collapsable={false}
              style={[styles.logButton, { backgroundColor: accent }]}
              onPress={openTooltip}
              hitSlop={4}>
              <Text style={styles.logButtonText}>+ Log</Text>
            </Pressable>
          )}
        </View>
      </Pressable>

      {/* Floating tooltip */}
      <Modal
        transparent
        visible={showTooltip}
        animationType="fade"
        onRequestClose={closeTooltip}>
        {/*
          Outer Pressable covers the full screen for dismiss-on-outside-tap.
          The bubble is a CHILD (not sibling) so its Pressables win the touch
          event first; anything outside the bubble propagates up to dismiss.
        */}
        <Pressable style={StyleSheet.absoluteFill} onPress={closeTooltip}>
          {cardLayout && (
            <Pressable
              style={[
                tipStyles.bubble,
                {
                  backgroundColor: colors.card,
                  left: tooltipLeft,
                  width: TOOLTIP_W,
                  top: cardLayout.y + cardLayout.height + 8,
                },
              ]}
              onPress={() => { /* absorb tap — prevents dismiss firing */ }}>
              {/* Upward-pointing arrow */}
              <View
                style={[
                  tipStyles.arrow,
                  {
                    borderBottomColor: colors.card,
                    left: arrowCentreX - 8,
                  },
                ]}
              />
              {renderTooltipContent()}
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </>
  );
}

/* ── Card styles ──────────────────────────────────────────────────── */
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
  emojiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sleepStatus: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
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

/* ── Tooltip styles ───────────────────────────────────────────────── */
const tipStyles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    borderRadius: Radius.lg,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    overflow: 'visible',
  },
  inner: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  heading: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sleepBtn: {
    borderRadius: Radius.full,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  sleepBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  sleepBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  sleepDurationCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: Spacing.sm,
    borderRightWidth: 1,
    borderRightColor: 'rgba(128,128,128,0.2)',
  },
  sleepDurationVal: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  sleepTimeRows: {
    flex: 1,
    gap: Spacing.xs,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  dateTimeChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  timeChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  arrow: {
    position: 'absolute',
    top: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  /* Slider */
  sliderSection: {
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  foodInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    fontSize: 14,
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountVal: {
    fontSize: 15,
    fontWeight: '700',
  },
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
  /* Log confirm buttons */
  logRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  logBtn: {
    flex: 1,
    borderRadius: Radius.full,
    paddingVertical: 9,
    alignItems: 'center',
  },
  logBtnPrimary: {
    // background set inline
  },
  logBtnSecondary: {
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  logBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
