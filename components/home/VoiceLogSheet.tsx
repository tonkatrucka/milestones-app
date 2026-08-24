/**
 * VoiceLogSheet — hold-or-tap microphone to dictate a quick log.
 *
 * Uses on-device speech recognition when the native module is present.
 * Falls back to typing / keyboard dictation otherwise.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDictation } from '@/hooks/use-dictation';
import type { DailyEvent } from '@/lib/database.types';

interface VoiceLogSheetProps {
  visible: boolean;
  onClose: () => void;
  childId: string | null;
  childName: string;
  childDob: string;
  onActivityLogged?: (events: DailyEvent[]) => void;
}

export function VoiceLogSheet({
  visible,
  onClose,
  childId,
  childName,
  childDob,
  onActivityLogged,
}: VoiceLogSheetProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const dictationPrefixRef = useRef('');
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleTranscript = useCallback((spoken: string) => {
    const prefix = dictationPrefixRef.current;
    setText(prefix + spoken);
  }, []);

  const { isListening, toggle: toggleDictationRaw, stop } = useDictation(handleTranscript);

  useEffect(() => {
    if (!visible && isListening) void stop();
  }, [visible, isListening, stop]);

  const toggleDictation = useCallback(() => {
    if (!isListening) {
      dictationPrefixRef.current = text.trim() ? `${text.trim()} ` : '';
      if (process.env.EXPO_OS === 'ios') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
    toggleDictationRaw();
  }, [isListening, text, toggleDictationRaw]);

  const handleSubmit = async () => {
    if (!text.trim() || !childId || isSending) return;
    if (isListening) await stop();
    Keyboard.dismiss();
    setIsSending(true);
    setLastResult(null);

    try {
      const { sendChatMessage } = await import('@/services/chat');
      const result = await sendChatMessage({
        childId,
        childName,
        childDob,
        message: text.trim(),
      });

      if (result.loggedEvents && result.loggedEvents.length > 0) {
        onActivityLogged?.(result.loggedEvents as unknown as DailyEvent[]);
      }
      setLastResult(result.content ?? 'Logged!');
      setText('');
      dictationPrefixRef.current = '';
    } catch {
      setLastResult('Could not log that — please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    void stop();
    setText('');
    setLastResult(null);
    dictationPrefixRef.current = '';
    Keyboard.dismiss();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'position' : undefined}
        keyboardVerticalOffset={0}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: insets.bottom + Spacing.md },
          ]}>
          <View style={styles.handle} />

          <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            Voice log
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Tap the mic and say what happened — &quot;wet nappy just now&quot;, &quot;bottle 120ml&quot;, &quot;woke up&quot;
          </Text>

          <Pressable
            style={[
              styles.micButton,
              { backgroundColor: isListening ? colors.primary : colors.inputBackground, borderColor: colors.primary },
            ]}
            onPress={toggleDictation}
            accessibilityRole="button"
            accessibilityLabel={isListening ? 'Stop listening' : 'Start dictation'}>
            <Ionicons
              name={isListening ? 'stop' : 'mic'}
              size={36}
              color={isListening ? '#fff' : colors.primary}
            />
            <Text style={[styles.micLabel, { color: isListening ? '#fff' : colors.primary }]}>
              {isListening ? 'Listening… tap to stop' : 'Tap to dictate'}
            </Text>
          </Pressable>

          <View
            style={[
              styles.inputRow,
              { backgroundColor: colors.inputBackground, borderColor: colors.border },
            ]}>
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: colors.text }]}
              placeholder="Or type here…"
              placeholderTextColor={colors.muted}
              value={text}
              onChangeText={setText}
              onSubmitEditing={() => void handleSubmit()}
              returnKeyType="send"
              multiline={false}
            />
            <Pressable
              style={[
                styles.sendButton,
                { backgroundColor: colors.primary },
                (!text.trim() || isSending) && { opacity: 0.4 },
              ]}
              onPress={() => void handleSubmit()}
              disabled={!text.trim() || isSending}
              accessibilityLabel="Submit log">
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </Pressable>
          </View>

          {lastResult && (
            <Text style={[styles.result, { color: colors.text }]} numberOfLines={3}>
              {lastResult}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface VoiceFabProps {
  onPress: () => void;
}

export function VoiceFab({ onPress }: VoiceFabProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const handlePress = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }, [onPress]);

  return (
    <Pressable
      style={[styles.fab, { backgroundColor: colors.elevated, borderColor: colors.primary }]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Voice log — dictate what happened">
      <Ionicons name="mic" size={24} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    alignSelf: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  micButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    paddingVertical: Spacing.lg,
    minHeight: 112,
  },
  micLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  result: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  fab: {
    position: 'absolute',
    right: Spacing.md + 56 + 12,
    bottom: Spacing.md,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
});
