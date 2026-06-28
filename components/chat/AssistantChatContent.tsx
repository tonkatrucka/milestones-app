import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  InteractionManager,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { localDateString } from '@/services/chat';
import { MessageBubble, TypingIndicator } from '@/components/chat/MessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import type { ChatMessage } from '@/lib/database.types';

const INPUT_BAR_PADDING = Spacing.sm;

type DaySeparatorItem = { type: 'day_separator'; id: string; label: string };
type ChatListItem = ChatMessage | DaySeparatorItem;

function isDaySeparator(item: ChatListItem): item is DaySeparatorItem {
  return 'type' in item && (item as DaySeparatorItem).type === 'day_separator';
}

function formatDayLabel(localDate: string): string {
  const today = localDateString();
  if (localDate === today) return 'Today';
  const [ty, tm, td] = today.split('-').map(Number);
  const [y, m, d] = localDate.split('-').map(Number);
  const diff = Math.round(
    (new Date(ty, tm - 1, td).getTime() - new Date(y, m - 1, d).getTime()) / 86_400_000,
  );
  if (diff === 1) return 'Yesterday';
  return format(new Date(y, m - 1, d), 'EEE d MMM');
}

function insertDaySeparators(messages: ChatMessage[]): ChatListItem[] {
  const items: ChatListItem[] = [];
  let lastDay = '';
  for (const msg of messages) {
    const day = localDateString(new Date(msg.created_at));
    if (day !== lastDay) {
      items.push({ type: 'day_separator', id: `sep-${day}`, label: formatDayLabel(day) });
      lastDay = day;
    }
    items.push(msg);
  }
  return items;
}

function DaySeparator({ label }: { label: string }) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  return (
    <View style={styles.daySep}>
      <View style={[styles.daySepLine, { backgroundColor: colors.border }]} />
      <Text style={[styles.daySepText, { color: colors.muted }]}>{label}</Text>
      <View style={[styles.daySepLine, { backgroundColor: colors.border }]} />
    </View>
  );
}

export type AssistantChatContentProps = {
  childId: string;
  childName: string;
  messages: ChatMessage[];
  isLoading: boolean;
  isAwaitingReply: boolean;
  hasMoreDays: boolean;
  isLoadingOlder: boolean;
  sendMessage: (
    text: string,
    imageUris?: string[],
    options?: { immediate?: boolean },
  ) => Promise<void>;
  sendQuickLog: (text: string) => Promise<void>;
  loadPreviousDay: () => Promise<void>;
  canWrite: boolean;
};

export function AssistantChatContent({
  childId,
  childName,
  messages,
  isLoading,
  isAwaitingReply,
  hasMoreDays,
  isLoadingOlder,
  sendMessage,
  sendQuickLog,
  loadPreviousDay,
  canWrite,
}: AssistantChatContentProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const listData = useMemo(() => insertDaySeparators(messages), [messages]);

  const listRef = useRef<FlatList<ChatListItem>>(null);
  const listViewportHeightRef = useRef(0);
  const [inputBarHeight, setInputBarHeight] = useState(112);

  const needsInitialScrollRef = useRef(true);
  const lastMsgIdRef = useRef<string | null>(null);
  const stickToBottomRef = useRef(false);
  const wasAwaitingReplyRef = useRef(false);
  const [initialScrollDone, setInitialScrollDone] = useState(false);

  const scrollToBottom = useCallback(
    (animated: boolean) => {
      if (messages.length === 0) return;
      InteractionManager.runAfterInteractions(() => {
        requestAnimationFrame(() => {
          listRef.current?.scrollToEnd({ animated });
        });
      });
    },
    [messages.length],
  );

  const completeInitialScrollIfNeeded = useCallback(() => {
    if (!needsInitialScrollRef.current || messages.length === 0) return;

    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: false });
        needsInitialScrollRef.current = false;
        lastMsgIdRef.current = messages[messages.length - 1]?.id ?? null;
        setInitialScrollDone(true);
      });
    });
  }, [messages]);

  useEffect(() => {
    needsInitialScrollRef.current = true;
    lastMsgIdRef.current = null;
    setInitialScrollDone(false);
  }, [childId]);

  useEffect(() => {
    if (!isLoading) {
      completeInitialScrollIfNeeded();
    }
  }, [isLoading, completeInitialScrollIfNeeded]);

  const isLoadingOlderRef = useRef(false);
  const hasMoreDaysRef = useRef(hasMoreDays);
  useEffect(() => {
    isLoadingOlderRef.current = isLoadingOlder;
  }, [isLoadingOlder]);
  useEffect(() => {
    hasMoreDaysRef.current = hasMoreDays;
  }, [hasMoreDays]);

  const maybeLoadOlderHistory = useCallback(
    (contentHeight: number) => {
      const viewportHeight = listViewportHeightRef.current;
      if (viewportHeight <= 0) return;
      const nearTop = contentHeight <= viewportHeight + 120;
      if (nearTop && hasMoreDaysRef.current && !isLoadingOlderRef.current) {
        loadPreviousDay();
      }
    },
    [loadPreviousDay],
  );

  const handleContentSizeChange = useCallback(
    (_width: number, height: number) => {
      if (needsInitialScrollRef.current) {
        completeInitialScrollIfNeeded();
      } else if (stickToBottomRef.current) {
        scrollToBottom(false);
      }
      maybeLoadOlderHistory(height);
    },
    [completeInitialScrollIfNeeded, scrollToBottom, maybeLoadOlderHistory],
  );

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.id === lastMsgIdRef.current) return;

    if (needsInitialScrollRef.current) {
      completeInitialScrollIfNeeded();
      return;
    }

    stickToBottomRef.current = true;
    scrollToBottom(!!lastMsgIdRef.current);
    lastMsgIdRef.current = lastMsg.id;
  }, [messages, scrollToBottom, completeInitialScrollIfNeeded]);

  useEffect(() => {
    if (isAwaitingReply) {
      stickToBottomRef.current = true;
      scrollToBottom(true);
    }
  }, [isAwaitingReply, scrollToBottom]);

  useEffect(() => {
    const replyJustArrived = wasAwaitingReplyRef.current && !isAwaitingReply;
    wasAwaitingReplyRef.current = isAwaitingReply;

    if (replyJustArrived && messages.length > 0) {
      stickToBottomRef.current = true;
      scrollToBottom(false);
      const t1 = setTimeout(() => scrollToBottom(false), 50);
      const t2 = setTimeout(() => scrollToBottom(false), 250);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isAwaitingReply, messages.length, scrollToBottom]);

  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollBtnAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(scrollBtnAnim, {
      toValue: showScrollBtn ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [showScrollBtn, scrollBtnAnim]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;

      if (contentOffset.y < 120 && hasMoreDaysRef.current && !isLoadingOlderRef.current) {
        loadPreviousDay();
      }

      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;
      const isNearBottom = distanceFromBottom <= 100;
      setShowScrollBtn(!isNearBottom);
      if (!isNearBottom) {
        stickToBottomRef.current = false;
      }
    },
    [loadPreviousDay],
  );

  const handleQuickLog = useCallback(
    (text: string) => {
      void sendQuickLog(text);
    },
    [sendQuickLog],
  );

  const handleInputBarLayout = useCallback((height: number) => {
    if (height > 0) {
      setInputBarHeight(height);
    }
  }, []);

  return (
    <View style={styles.flex}>
      <FlatList<ChatListItem>
          ref={listRef}
          style={styles.flex}
          data={listData}
          keyExtractor={(item) => item.id}
          onLayout={(e) => {
            listViewportHeightRef.current = e.nativeEvent.layout.height;
          }}
          renderItem={({ item }) => {
            if (isDaySeparator(item)) return <DaySeparator label={item.label} />;
            return <MessageBubble message={item as ChatMessage} />;
          }}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Spacing.md },
            listData.length === 0 && styles.listContentEmpty,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onContentSizeChange={handleContentSizeChange}
          maintainVisibleContentPosition={
            initialScrollDone ? { minIndexForVisible: 0 } : undefined
          }
          ListHeaderComponent={
            isLoadingOlder ? (
              <View style={styles.loadingOlder}>
                <ActivityIndicator size="small" color={colors.muted} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>✨</Text>
                <Text
                  style={[
                    styles.emptyTitle,
                    { color: colors.text, fontFamily: Fonts!.rounded },
                  ]}>
                  Hey! I'm here to help
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                  Tell me what's happening with {childName} — nappy changes, feeds, naps, first
                  words, or a special memory. I'll log it all for you.
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={isAwaitingReply ? <TypingIndicator /> : null}
        />

        <Animated.View
          style={[
            styles.scrollToBottomBtn,
            {
              bottom: inputBarHeight + Spacing.sm,
            },
            {
              backgroundColor: colors.elevated,
              borderColor: colors.border,
              opacity: scrollBtnAnim,
              transform: [
                {
                  scale: scrollBtnAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ],
            },
          ]}
          pointerEvents={showScrollBtn ? 'auto' : 'none'}>
          <Pressable onPress={() => scrollToBottom(true)} hitSlop={8}>
            <Ionicons name="chevron-down" size={20} color={colors.primary} />
          </Pressable>
        </Animated.View>

        <View
          onLayout={(e) => handleInputBarLayout(e.nativeEvent.layout.height)}
          style={[
            styles.inputWrapper,
            {
              backgroundColor: colors.elevated,
              borderTopColor: colors.border,
              paddingTop: INPUT_BAR_PADDING,
              paddingBottom: INPUT_BAR_PADDING,
            },
          ]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listContent: {
    paddingTop: Spacing.md,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  loadingOlder: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  daySep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  daySepLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  daySepText: {
    fontSize: 12,
    fontWeight: '500',
  },
  inputWrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
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
  scrollToBottomBtn: {
    position: 'absolute',
    right: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    paddingVertical: Spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
});
