import type { ChatMessage } from '@/lib/database.types';

/** Returns the most recent user message and the assistant reply that follows it. */
export function getLatestExchange(messages: ChatMessage[]): {
  user: ChatMessage | null;
  assistant: ChatMessage | null;
} {
  if (messages.length === 0) return { user: null, assistant: null };

  let lastUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      lastUserIndex = i;
      break;
    }
  }

  if (lastUserIndex === -1) {
    const last = messages[messages.length - 1];
    return { user: null, assistant: last.role === 'assistant' ? last : null };
  }

  const user = messages[lastUserIndex];
  let assistant: ChatMessage | null = null;
  for (let i = lastUserIndex + 1; i < messages.length; i++) {
    if (messages[i].role === 'assistant') {
      assistant = messages[i];
      break;
    }
  }

  return { user, assistant };
}
