import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { format } from 'date-fns';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useActiveChild } from '@/hooks/use-active-child';
import { useAppStore } from '@/store/app-store';
import { useChat } from '@/hooks/use-chat';
import { localDateString } from '@/services/chat';
import { MessageBubble, TypingIndicator } from '@/components/chat/MessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import type { ChatMessage } from '@/lib/database.types';

const INPUT_BAR_PADDING = Spacing.sm;

// ─── Day separator ────────────────────────────────────────────────────────────

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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const tabBarHeight = useBottomTabBarHeight();
  const { session } = useAuth();
  const { activeChild } = useActiveChild(session?.user.id ?? null);
  const activeChildId = useAppStore((s) => s.activeChildId);

  const {
    messages,
    isLoading,
    isAwaitingReply,
    hasMoreDays,
    isLoadingOlder,
    sendMessage,
    loadPreviousDay,
  } = useChat(
    activeChildId,
    activeChild?.name ?? null,
    activeChild?.date_of_birth ?? null,
  );

  const listData = useMemo(() => insertDaySeparators(messages), [messages]);

  const listRef = useRef<FlatList<ChatListItem>>(null);

  // Scroll to end when a new message is appended (but NOT when older messages are prepended)
  const lastMsgIdRef = useRef<string | null>(null);
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.id !== lastMsgIdRef.current) {
      listRef.current?.scrollToEnd({ animated: !!lastMsgIdRef.current });
      lastMsgIdRef.current = lastMsg.id;
    }
  }, [messages]);

  // Keyboard shows → scroll to end
  const scrollToEnd = useCallback(() => {
    if (messages.length > 0) listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, scrollToEnd);
    return () => sub.remove();
  }, [scrollToEnd]);

  // Load older messages when user scrolls near the top
  const isLoadingOlderRef = useRef(false);
  useEffect(() => {
    isLoadingOlderRef.current = isLoadingOlder;
  }, [isLoadingOlder]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (e.nativeEvent.contentOffset.y < 80 && !isLoadingOlderRef.current && hasMoreDays) {
        loadPreviousDay();
      }
    },
    [hasMoreDays, loadPreviousDay],
  );

  // Quick-log chips call sendMessage with immediate flush (intent parser bypasses Claude)
  const handleQuickLog = useCallback(
    (text: string) => {
      sendMessage(text, undefined, { immediate: true });
    },
    [sendMessage],
  );

  if (!activeChild) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.flex, styles.centred, { backgroundColor: colors.background }]}>
        <Text style={styles.emptyEmoji}>💬</Text>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No child selected</Text>
        <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
          Add a child profile in Settings to get started.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text
          style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}
          numberOfLines={1}
          adjustsFontSizeToFit>
          Assistant
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Tell me about {activeChild.name}'s day
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        <FlatList<ChatListItem>
          ref={listRef}
          style={styles.flex}
          data={listData}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            if (isDaySeparator(item)) return <DaySeparator label={item.label} />;
            return <MessageBubble message={item as ChatMessage} />;
          }}
          contentContainerStyle={[
            styles.listContent,
            listData.length === 0 && styles.listContentEmpty,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={100}
          onScroll={handleScroll}
          // Preserves scroll position when older messages are prepended (iOS only)
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
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
                  Tell me what's happening with {activeChild.name} — nappy changes, feeds, naps,
                  first words, or a special memory. I'll log it all for you.
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={isAwaitingReply ? <TypingIndicator /> : null}
        />

        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingTop: INPUT_BAR_PADDING,
              // Push the input bar above the tab bar (tabBarHeight includes the
              // bottom safe-area inset on notched devices).
              paddingBottom: tabBarHeight + INPUT_BAR_PADDING,
            },
          ]}>
          <ChatInput
            onSend={sendMessage}
            onQuickLog={handleQuickLog}
            disabled={isAwaitingReply}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centred: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  listContent: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
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
