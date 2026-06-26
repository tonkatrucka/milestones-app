import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import {
  getChatMessagesForDay,
  getOldestMsgBeforeDay,
  getRecentChatContext,
  localDateString,
  MAX_CHAT_PHOTOS,
  saveChatMessage,
} from '@/services/chat';
import { uploadChatMediaBatch } from '@/services/media';
import {
  linkChatPhotosToRecentRecords,
  photoUrlsFromBatchMessages,
} from '@/services/chat-media-link';
import type { ChatMessage, DailyEvent } from '@/lib/database.types';

const DEBOUNCE_MS = 3000;
const CONTEXT_LIMIT = 10;

export function useChat(
  childId: string | null,
  childName: string | null,
  childDob: string | null,
  onActivityLogged?: (events: DailyEvent[]) => void,
) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAwaitingReply, setIsAwaitingReply] = useState(false);
  const [hasMoreDays, setHasMoreDays] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  const oldestLoadedDayRef = useRef<string>(localDateString());
  const loadingOlderRef = useRef(false);
  const hasMoreDaysRef = useRef(true);
  const pendingBatchRef = useRef<{ ids: string[]; hasPhoto: boolean }>({
    ids: [],
    hasPhoto: false,
  });
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentFlushIdsRef = useRef<Set<string>>(new Set());
  const flushInProgressRef = useRef(false);

  useEffect(() => {
    hasMoreDaysRef.current = hasMoreDays;
  }, [hasMoreDays]);

  // Initial load: today's messages, or the most recent day with messages if today is empty
  useEffect(() => {
    if (!childId || !userId) {
      setMessages([]);
      setHasMoreDays(true);
      hasMoreDaysRef.current = true;
      loadingOlderRef.current = false;
      setIsLoadingOlder(false);
      return;
    }

    setIsLoading(true);
    setHasMoreDays(true);
    hasMoreDaysRef.current = true;
    loadingOlderRef.current = false;
    setIsLoadingOlder(false);
    const today = localDateString();
    oldestLoadedDayRef.current = today;

    const loadInitial = async () => {
      const todayMsgs = await getChatMessagesForDay(childId, today);
      if (todayMsgs.length > 0) {
        setMessages(todayMsgs);
        return;
      }
      // Today is empty — find the most recent day that has messages
      const prevTs = await getOldestMsgBeforeDay(childId, today);
      if (!prevTs) {
        setMessages([]);
        setHasMoreDays(false);
        hasMoreDaysRef.current = false;
        return;
      }
      const prevDay = localDateString(new Date(prevTs));
      const prevMsgs = await getChatMessagesForDay(childId, prevDay);
      setMessages(prevMsgs);
      oldestLoadedDayRef.current = prevDay;
    };

    loadInitial()
      .catch((e) => console.error('[useChat] initial load failed:', e))
      .finally(() => setIsLoading(false));
  }, [childId, userId]);

  // Clear debounce timer when the active child or user changes
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [childId, userId]);

  const flushBatch = useCallback(async () => {
    if (!childId || !childName || !childDob || flushInProgressRef.current) return;

    const batchIds = new Set(pendingBatchRef.current.ids);
    if (batchIds.size === 0) return;

    // Claim the batch before any awaits
    pendingBatchRef.current = { ids: [], hasPhoto: false };
    currentFlushIdsRef.current = batchIds;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    flushInProgressRef.current = true;
    setIsAwaitingReply(true);

    try {
      // Fetch a fresh 10-message context from DB — not the full UI-loaded history
      const context = await getRecentChatContext(childId, CONTEXT_LIMIT);

      const toApiMessage = (m: ChatMessage) => {
        if (m.media_urls.length > 0 && m.role === 'user' && batchIds.has(m.id)) {
          const photos = m.media_urls.slice(0, MAX_CHAT_PHOTOS);
          return {
            role: m.role as 'user' | 'assistant',
            content: [
              ...photos.map((url) => ({
                type: 'image' as const,
                source: { type: 'url' as const, url },
              })),
              { type: 'text' as const, text: m.content },
            ],
          };
        }
        return { role: m.role as 'user' | 'assistant', content: m.content };
      };

      // Split into actionable (current batch) vs read-only context (prior history).
      // Only batch messages may trigger tool calls in the edge function.
      const batchMessages = context.filter((m) => batchIds.has(m.id));
      const contextMessages = context.filter((m) => !batchIds.has(m.id));

      if (batchMessages.length === 0) return;

      const attachedMediaUrls = photoUrlsFromBatchMessages(batchMessages);

      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          messages: batchMessages.map(toApiMessage),
          contextMessages: contextMessages.map(toApiMessage),
          attachedMediaUrls,
          child: { id: childId, name: childName, date_of_birth: childDob },
          currentDate: localDateString(),
        },
      });

      if (error) {
        if ('context' in error) {
          const ctx = error.context as Response;
          const body = await ctx.text().catch(() => '(unreadable)');
          console.error('[useChat] edge function error body:', body);
        }
        throw error;
      }

      // Safety net: ensure photos land on the memory/milestone even if the
      // deployed edge function hasn't been updated yet.
      if (attachedMediaUrls.length > 0) {
        await linkChatPhotosToRecentRecords(childId, attachedMediaUrls).catch((e) =>
          console.error('[useChat] linkChatPhotosToRecentRecords failed:', e),
        );
      }

      const replyText: string = data?.content ?? "I couldn't process that, please try again.";
      const loggedEvents = (data?.loggedEvents ?? []) as DailyEvent[];
      if (loggedEvents.length > 0) {
        onActivityLogged?.(loggedEvents);
      }
      const savedAssistant = await saveChatMessage(childId, 'assistant', replyText, []);
      setMessages((prev) => [...prev, savedAssistant]);
    } catch (e) {
      console.error('[useChat] flushBatch failed:', e);
    } finally {
      flushInProgressRef.current = false;
      setIsAwaitingReply(false);
      currentFlushIdsRef.current = new Set();
      // If messages arrived while the API call was in flight, schedule a follow-up flush
      if (pendingBatchRef.current.ids.length > 0 && !debounceTimerRef.current) {
        debounceTimerRef.current = setTimeout(() => flushBatch(), DEBOUNCE_MS);
      }
    }
  }, [childId, childName, childDob, onActivityLogged]);

  const sendMessage = useCallback(
    async (text: string, imageUris: string[] = [], options?: { immediate?: boolean }) => {
      if (!childId || !childName || !childDob || !userId) return;

      const immediate = options?.immediate ?? false;
      const photos = imageUris.slice(0, MAX_CHAT_PHOTOS);

      const tempId = `tmp-${Date.now()}-${Math.random()}`;
      const tempMsg: ChatMessage = {
        id: tempId,
        child_id: childId,
        user_id: userId ?? '',
        role: 'user',
        content: text,
        media_urls: photos,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempMsg]);

      try {
        let mediaUrls: string[] = [];
        if (photos.length > 0) {
          mediaUrls = await uploadChatMediaBatch(childId, photos);
        }

        const savedUser = await saveChatMessage(childId, 'user', text, mediaUrls);
        setMessages((prev) => prev.map((m) => (m.id === tempId ? savedUser : m)));

        pendingBatchRef.current.ids.push(savedUser.id);
        if (photos.length > 0) pendingBatchRef.current.hasPhoto = true;

        if (photos.length > 0 || immediate) {
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
          }
          if (!flushInProgressRef.current) {
            await flushBatch();
          } else {
            // A flush is in progress; retry shortly after it completes
            debounceTimerRef.current = setTimeout(() => flushBatch(), 500);
          }
          return;
        }

        // Text messages: start/reset the 3s debounce
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => flushBatch(), DEBOUNCE_MS);
      } catch (e) {
        console.error('[useChat] sendMessage failed:', e);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    },
    [childId, childName, childDob, userId, flushBatch],
  );

  const loadPreviousDay = useCallback(async () => {
    if (!childId || loadingOlderRef.current || !hasMoreDaysRef.current) return;

    loadingOlderRef.current = true;
    setIsLoadingOlder(true);

    try {
      let cursor = oldestLoadedDayRef.current;

      // Walk backward day-by-day, skipping empty calendar days
      for (let attempt = 0; attempt < 366; attempt++) {
        const prevTs = await getOldestMsgBeforeDay(childId, cursor);
        if (!prevTs) {
          setHasMoreDays(false);
          hasMoreDaysRef.current = false;
          return;
        }

        const prevDay = localDateString(new Date(prevTs));
        const older = await getChatMessagesForDay(childId, prevDay);
        oldestLoadedDayRef.current = prevDay;
        cursor = prevDay;

        if (older.length === 0) continue;

        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const fresh = older.filter((m) => !seen.has(m.id));
          return fresh.length > 0 ? [...fresh, ...prev] : prev;
        });
        return;
      }
    } catch (e) {
      console.error('[useChat] loadPreviousDay failed:', e);
    } finally {
      loadingOlderRef.current = false;
      setIsLoadingOlder(false);
    }
  }, [childId]);

  return {
    messages,
    isLoading,
    isAwaitingReply,
    hasMoreDays,
    isLoadingOlder,
    sendMessage,
    loadPreviousDay,
  };
}
