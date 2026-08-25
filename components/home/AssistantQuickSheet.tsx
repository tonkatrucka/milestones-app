import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  InteractionManager,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useChat } from '@/hooks/use-chat';
import { getLatestExchange } from '@/lib/chat-latest-exchange';
import { AssistantChatContent } from '@/components/chat/AssistantChatContent';
import { MessageBubble, TypingIndicator } from '@/components/chat/MessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import type { DailyEvent } from '@/lib/database.types';
import type { ChatMessage } from '@/lib/database.types';
import type { LayoutRect } from '@/store/log-confirmation-store';

type AssistantMode = 'quick' | 'full';

interface AssistantQuickSheetProps {
  visible: boolean;
  onClose: () => void;
  childId: string | null;
  childName: string | null;
  childDob: string | null;
  canWrite: boolean;
  onActivityLogged?: (events: DailyEvent[], origin?: LayoutRect) => void;
}

export function AssistantQuickSheet({
  visible,
  onClose,
  childId,
  childName,
  childDob,
  canWrite,
  onActivityLogged,
}: AssistantQuickSheetProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 48 : 0);
  const keyboardHeight = useKeyboardState((state) =>
    state.isVisible ? state.height : 0,
  );
  const composerBottomPad = Spacing.sm + Math.max(keyboardHeight, bottomInset);
  const [mode, setMode] = useState<AssistantMode>('quick');
  const [hideForPicker, setHideForPicker] = useState(false);

  const handleActivityLogged = useCallback(
    (events: DailyEvent[]) => {
      const { width, height } = Dimensions.get('window');
      const origin: LayoutRect = {
        x: Spacing.md,
        y: height * 0.72,
        width: width - Spacing.md * 2,
        height: 56,
      };
      onActivityLogged?.(events, origin);
    },
    [onActivityLogged],
  );

  const {
    messages,
    isLoading,
    isAwaitingReply,
    hasMoreDays,
    isLoadingOlder,
    sendMessage,
    sendQuickLog,
    loadPreviousDay,
  } = useChat(
    visible ? childId : null,
    visible ? childName : null,
    visible ? childDob : null,
    handleActivityLogged,
  );

  const { user, assistant } = useMemo(() => getLatestExchange(messages), [messages]);

  useEffect(() => {
    if (!visible) {
      setMode('quick');
      setHideForPicker(false);
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    setMode('quick');
    setHideForPicker(false);
    onClose();
  }, [onClose]);

  const handleQuickLog = useCallback(
    (text: string) => {
      void sendQuickLog(text);
    },
    [sendQuickLog],
  );

  const handleViewAll = useCallback(() => {
    setMode('full');
  }, []);

  const handleBeforeNativePicker = useCallback(async () => {
    Keyboard.dismiss();
    setHideForPicker(true);
    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => {
        setTimeout(resolve, 350);
      });
    });
  }, []);

  const handleAfterNativePicker = useCallback(() => {
    setHideForPicker(false);
  }, []);

  const isFull = mode === 'full';

  const fullChatBody =
    childId && childName ? (
      <AssistantChatContent
        childId={childId}
        childName={childName}
        messages={messages}
        isLoading={isLoading}
        isAwaitingReply={isAwaitingReply}
        hasMoreDays={hasMoreDays}
        isLoadingOlder={isLoadingOlder}
        sendMessage={sendMessage}
        sendQuickLog={sendQuickLog}
        loadPreviousDay={loadPreviousDay}
        canWrite={canWrite}
        onBeforeNativePicker={handleBeforeNativePicker}
        onAfterNativePicker={handleAfterNativePicker}
      />
    ) : null;

  const quickInputBar = canWrite ? (
    <View
      style={[
        styles.inputDock,
        {
          backgroundColor: colors.elevated,
          borderTopColor: colors.border,
          paddingBottom: composerBottomPad,
        },
      ]}>
      <ChatInput
        onSend={sendMessage}
        onQuickLog={handleQuickLog}
        disabled={isAwaitingReply}
        onBeforeNativePicker={handleBeforeNativePicker}
        onAfterNativePicker={handleAfterNativePicker}
      />
    </View>
  ) : (
    <View style={[styles.viewerNotice, { paddingBottom: composerBottomPad }]}>
      <Text style={[styles.viewerNoticeText, { color: colors.muted }]}>
        View-only access — you can read messages but cannot chat or log events.
      </Text>
    </View>
  );

  const sheetContent = (
    <View style={styles.modalRoot}>
      {isFull ? (
        <FullAssistantSheetBody
          colors={colors}
          childName={childName}
          topInset={insets.top}
          onClose={handleClose}>
          {fullChatBody}
        </FullAssistantSheetBody>
      ) : (
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.backdrop}
            onPress={handleClose}
            accessibilityLabel="Close assistant"
          />
          <QuickAssistantSheetBody
            colors={colors}
            childName={childName}
            user={user}
            assistant={assistant}
            isLoading={isLoading}
            isAwaitingReply={isAwaitingReply}
            onViewAll={handleViewAll}
            onClose={handleClose}
          />
          {quickInputBar}
        </View>
      )}
    </View>
  );

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}>
      <View
        style={hideForPicker ? styles.hiddenForPicker : styles.flex}
        pointerEvents={hideForPicker ? 'none' : 'auto'}>
        {sheetContent}
      </View>
    </Modal>
  );
}

interface QuickAssistantSheetBodyProps {
  colors: (typeof Colors)['light'];
  childName: string | null;
  user: ChatMessage | null;
  assistant: ChatMessage | null;
  isLoading: boolean;
  isAwaitingReply: boolean;
  onViewAll: () => void;
  onClose: () => void;
}

function QuickAssistantSheetBody({
  colors,
  childName,
  user,
  assistant,
  isLoading,
  isAwaitingReply,
  onViewAll,
  onClose,
}: QuickAssistantSheetBodyProps) {
  const windowHeight = Dimensions.get('window').height;
  const sheetMaxHeight = Math.max(windowHeight * 0.72, 220);

  return (
    <View style={styles.quickRoot} pointerEvents="box-none">
      <View
        style={[
          styles.sheet,
          styles.sheetQuick,
          {
            backgroundColor: colors.elevated,
            borderColor: colors.border,
            maxHeight: Math.min(sheetMaxHeight, windowHeight - Spacing.xl),
          },
        ]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>
              Ask Milestones
            </Text>
            {childName ? (
              <Text style={[styles.subtitle, { color: colors.muted }]}>
                Log or ask anything about {childName}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={onViewAll} hitSlop={8} style={styles.viewAllBtn}>
            <Text style={[styles.viewAllText, { color: colors.primary }]}>View all</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.muted} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.messages}
          contentContainerStyle={[
            styles.messagesContent,
            !user && !assistant && !isLoading && styles.messagesEmpty,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            <>
              {!user && !assistant && (
                <View style={styles.emptyHint}>
                  <Text style={styles.emptyEmoji}>✨</Text>
                  <Text
                    style={[
                      styles.emptyTitle,
                      { color: colors.text, fontFamily: Fonts!.rounded },
                    ]}>
                    What happened today?
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                    Tell me about feeds, naps, nappies, or a special moment — I'll log it for you.
                  </Text>
                </View>
              )}
              {user ? <MessageBubble message={user} /> : null}
              {isAwaitingReply ? (
                <TypingIndicator />
              ) : assistant ? (
                <MessageBubble message={assistant} />
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function FullAssistantSheetBody({
  colors,
  childName,
  topInset,
  onClose,
  children,
}: {
  colors: (typeof Colors)['light'];
  childName: string | null;
  topInset: number;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <View style={[styles.fullScreen, { paddingTop: topInset }]}>
      <View style={[styles.sheet, styles.sheetFull, { backgroundColor: colors.elevated }]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text
              style={[
                styles.title,
                styles.titleFull,
                { color: colors.text, fontFamily: Fonts!.rounded },
              ]}>
              Ask Milestones
            </Text>
            {childName ? (
              <Text style={[styles.subtitle, { color: colors.muted }]}>
                Log or ask anything about {childName}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.muted} />
          </Pressable>
        </View>

        <View style={styles.flex}>{children}</View>
      </View>
    </View>
  );
}

interface AssistantFabProps {
  onPress: () => void;
}

export function AssistantFab({ onPress }: AssistantFabProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const handlePress = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }, [onPress]);

  return (
    <Pressable
      style={[styles.fab, { backgroundColor: colors.primary }]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Ask Milestones — log or ask anything">
      <Ionicons name="chatbubble-ellipses" size={26} color={colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  quickRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  fullScreen: {
    flex: 1,
  },
  sheet: {},
  flex: { flex: 1 },
  hiddenForPicker: {
    flex: 1,
    opacity: 0,
  },
  sheetQuick: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetFull: {
    flex: 1,
  },
  inputDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  titleFull: {
    fontSize: 26,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  viewAllBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  messages: {
    flexGrow: 0,
    flexShrink: 1,
  },
  messagesContent: {
    paddingVertical: Spacing.sm,
  },
  messagesEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  loader: {
    paddingVertical: Spacing.xl,
  },
  emptyHint: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  viewerNotice: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  viewerNoticeText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  fab: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 5,
  },
});
