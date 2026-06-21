import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  getChatMessagesForDay,
  getOldestMsgBeforeDay,
  getRecentChatContext,
  localDateString,
  saveChatMessage,
} from '@/services/chat';
import { uploadChatMedia } from '@/services/media';
import type { ChatMessage } from '@/lib/database.types';

const DEBOUNCE_MS = 3000;
const CONTEXT_LIMIT = 10;

export function useChat(
  childId: string | null,
  childName: string | null,
  childDob: string | null,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAwaitingReply, setIsAwaitingReply] = useState(false);
  const [hasMoreDays, setHasMoreDays] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  const oldestLoadedDayRef = useRef<string>(localDateString());
  const pendingBatchRef = useRef<{ ids: string[]; hasPhoto: boolean }>({
    ids: [],
    hasPhoto: false,
  });
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentFlushIdsRef = useRef<Set<string>>(new Set());
  const flushInProgressRef = useRef(false);

  // Initial load: today's messages, or the most recent day with messages if today is empty
  useEffect(() => {
    if (!childId) {
      setMessages([]);
      setHasMoreDays(true);
      return;
    }

    setIsLoading(true);
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
  }, [childId]);

  // Clear debounce timer when the active child changes
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [childId]);

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
          return {
            role: m.role as 'user' | 'assistant',
            content: [
              { type: 'image', source: { type: 'url', url: m.media_urls[0] } },
              { type: 'text', text: m.content },
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

      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          messages: batchMessages.map(toApiMessage),
          contextMessages: contextMessages.map(toApiMessage),
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

      const replyText: string = data?.content ?? "I couldn't process that, please try again.";
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
  }, [childId, childName, childDob]);

  const sendMessage = useCallback(
    async (text: string, imageUri?: string, options?: { immediate?: boolean }) => {
      if (!childId || !childName || !childDob) return;

      const immediate = options?.immediate ?? false;

      const tempId = `tmp-${Date.now()}-${Math.random()}`;
      const tempMsg: ChatMessage = {
        id: tempId,
        child_id: childId,
        role: 'user',
        content: text,
        media_urls: imageUri ? [imageUri] : [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempMsg]);

      try {
        let mediaUrls: string[] = [];
        if (imageUri) {
          const publicUrl = await uploadChatMedia(childId, imageUri);
          mediaUrls = [publicUrl];
        }

        const savedUser = await saveChatMessage(childId, 'user', text, mediaUrls);
        setMessages((prev) => prev.map((m) => (m.id === tempId ? savedUser : m)));

        pendingBatchRef.current.ids.push(savedUser.id);
        if (imageUri) pendingBatchRef.current.hasPhoto = true;

        if (imageUri || immediate) {
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
    [childId, childName, childDob, flushBatch],
  );

  const loadPreviousDay = useCallback(async () => {
    if (!childId || isLoadingOlder || !hasMoreDays) return;
    setIsLoadingOlder(true);
    try {
      const prevTs = await getOldestMsgBeforeDay(childId, oldestLoadedDayRef.current);
      if (!prevTs) {
        setHasMoreDays(false);
        return;
      }
      const prevDay = localDateString(new Date(prevTs));
      const older = await getChatMessagesForDay(childId, prevDay);
      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
        oldestLoadedDayRef.current = prevDay;
      }
    } catch (e) {
      console.error('[useChat] loadPreviousDay failed:', e);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [childId, isLoadingOlder, hasMoreDays]);

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
