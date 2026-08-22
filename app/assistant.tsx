import { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { AssistantChatContent } from '@/components/chat/AssistantChatContent';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useActiveChild } from '@/hooks/use-active-child';
import { useMemberRole } from '@/hooks/use-member-role';
import { useAppStore } from '@/store/app-store';
import { useChat } from '@/hooks/use-chat';
import { useLogConfirmationStore } from '@/store/log-confirmation-store';
import type { Child, ChatMessage, DailyEvent } from '@/lib/database.types';
import type { LayoutRect } from '@/store/log-confirmation-store';

function AssistantScreenBody({
  colors,
  activeChild,
  canWrite,
  messages,
  isLoading,
  isAwaitingReply,
  hasMoreDays,
  isLoadingOlder,
  sendMessage,
  sendQuickLog,
  loadPreviousDay,
  onClose,
}: {
  colors: (typeof Colors)['light'];
  activeChild: Child;
  canWrite: boolean;
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
  onClose: () => void;
}) {
  return (
    <View style={styles.flex}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            Assistant
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Tell me about {activeChild.name}'s day
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
          <Ionicons name="close" size={22} color={colors.muted} />
        </Pressable>
      </View>

      <AssistantChatContent
        childId={activeChild.id}
        childName={activeChild.name}
        messages={messages}
        isLoading={isLoading}
        isAwaitingReply={isAwaitingReply}
        hasMoreDays={hasMoreDays}
        isLoadingOlder={isLoadingOlder}
        sendMessage={sendMessage}
        sendQuickLog={sendQuickLog}
        loadPreviousDay={loadPreviousDay}
        canWrite={canWrite}
      />
    </View>
  );
}

export default function AssistantScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const { session } = useAuth();
  const { activeChild, isBootstrapping } = useActiveChild(session?.user.id ?? null);
  const activeChildId = useAppStore((s) => s.activeChildId);
  const { canWrite } = useMemberRole(activeChildId, session?.user.id ?? null);
  const confirmLog = useLogConfirmationStore((s) => s.confirmLog);

  const handleActivityLogged = useCallback(
    (events: DailyEvent[], origin?: LayoutRect) => {
      if (events.length > 0) {
        confirmLog(events[events.length - 1], origin);
      }
    },
    [confirmLog],
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
  } =   useChat(
    activeChild?.id ?? null,
    activeChild?.name ?? null,
    activeChild?.date_of_birth ?? null,
    handleActivityLogged,
  );

  useEffect(() => {
    if (!isBootstrapping && !activeChild) {
      router.back();
    }
  }, [isBootstrapping, activeChild, router]);

  if (isBootstrapping || !activeChild) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right', 'bottom']}
        style={[styles.flex, styles.center, { backgroundColor: colors.elevated }]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.flex, { backgroundColor: colors.elevated }]}>
        <AssistantScreenBody
          colors={colors}
          activeChild={activeChild}
          canWrite={canWrite}
          messages={messages}
          isLoading={isLoading}
          isAwaitingReply={isAwaitingReply}
          hasMoreDays={hasMoreDays}
          isLoadingOlder={isLoadingOlder}
          sendMessage={sendMessage}
          sendQuickLog={sendQuickLog}
          loadPreviousDay={loadPreviousDay}
          onClose={() => router.back()}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
});
