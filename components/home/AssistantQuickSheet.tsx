import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const [mode, setMode] = useState<AssistantMode>('quick');

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
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    setMode('quick');
    onClose();
  }, [onClose]);

  const handleQuickLog = useCallback(
    (text: string) => {
      sendMessage(text, undefined, { immediate: true });
    },
    [sendMessage],
  );

  const handleViewAll = useCallback(() => {
    setMode('full');
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
        loadPreviousDay={loadPreviousDay}
        canWrite={canWrite}
      />
    ) : null;

  const fullModeContent = (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.sheet, styles.sheetFull, { backgroundColor: colors.elevated }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text
            style={[
              styles.title,
              styles.titleFull,
              { color: colors.text, fontFamily: Fonts!.rounded },
            ]}>
            Assistant
          </Text>
          {childName ? (
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Tell me about {childName}'s day
            </Text>
          ) : null}
        </View>
        <Pressable onPress={handleClose} hitSlop={8} accessibilityLabel="Close">
          <Ionicons name="close" size={22} color={colors.muted} />
        </Pressable>
      </View>

      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={0}>
          {fullChatBody}
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.flex}>{fullChatBody}</View>
      )}
    </SafeAreaView>
  );

  const quickModeContent = (
    <SafeAreaView
      edges={[]}
      style={[
        styles.sheet,
        styles.sheetQuick,
        { backgroundColor: colors.elevated, borderColor: colors.border },
      ]}>
      <View style={[styles.handle, { backgroundColor: colors.border }]} />

      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            Assistant
          </Text>
          {childName ? (
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Quick log for {childName}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={handleViewAll} hitSlop={8} style={styles.viewAllBtn}>
          <Text style={[styles.viewAllText, { color: colors.primary }]}>View all</Text>
        </Pressable>
        <Pressable onPress={handleClose} hitSlop={8} accessibilityLabel="Close">
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

      <View style={[styles.inputWrapper, { borderTopColor: colors.border }]}>
        {canWrite ? (
          <ChatInput
            onSend={sendMessage}
            onQuickLog={handleQuickLog}
            disabled={isAwaitingReply}
          />
        ) : (
          <View style={styles.viewerNotice}>
            <Text style={[styles.viewerNoticeText, { color: colors.muted }]}>
              View-only access — you can read messages but cannot chat or log events.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      {!isFull && (
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
          accessibilityLabel="Close assistant"
        />
      )}

      {isFull ? (
        <View style={styles.fullScreen}>{fullModeContent}</View>
      ) : (
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none">
          {quickModeContent}
        </KeyboardAvoidingView>
      )}
    </Modal>
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
      style={[
        styles.fab,
        {
          backgroundColor: colors.primary,
          shadowColor: colors.primary,
        },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Open assistant">
      <Ionicons name="chatbubble-ellipses" size={26} color={colors.onPrimary} />
    </Pressable>
  );
}

const SHEET_MAX_HEIGHT = Dimensions.get('window').height * 0.72;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  fullScreen: {
    flex: 1,
  },
  sheet: {
    overflow: 'hidden',
  },
  flex: { flex: 1 },
  sheetQuick: {
    maxHeight: SHEET_MAX_HEIGHT,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetFull: {
    flex: 1,
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
  inputWrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
