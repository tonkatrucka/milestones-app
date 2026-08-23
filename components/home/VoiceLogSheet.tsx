/**
 * VoiceLogSheet — a bottom sheet with a large text input for
 * quick spoken or typed logging from the home screen.
 *
 * The user speaks via their keyboard's built-in dictation (iOS/Android)
 * or types normally. The text is sent to the existing AI assistant,
 * which parses and logs the event automatically.
 */

import { useRef, useState } from 'react';
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
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
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
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!text.trim() || !childId || isSending) return;
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
        onActivityLogged?.(result.loggedEvents as DailyEvent[]);
      }
      setLastResult(result.content ?? 'Logged!');
      setText('');
    } catch {
      setLastResult('Could not log that — please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setText('');
    setLastResult(null);
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
            Quick log
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Type or dictate what happened — &quot;wet nappy just now&quot;, &quot;bottle 120ml&quot;, &quot;woke up&quot;
          </Text>

          <View
            style={[
              styles.inputRow,
              { backgroundColor: colors.inputBackground, borderColor: colors.border },
            ]}>
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: colors.text }]}
              placeholder="e.g. wet nappy just now…"
              placeholderTextColor={colors.muted}
              value={text}
              onChangeText={setText}
              onSubmitEditing={handleSubmit}
              autoFocus
              returnKeyType="send"
              multiline={false}
            />
            <Pressable
              style={[
                styles.sendButton,
                { backgroundColor: colors.primary },
                (!text.trim() || isSending) && { opacity: 0.4 },
              ]}
              onPress={handleSubmit}
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
});
