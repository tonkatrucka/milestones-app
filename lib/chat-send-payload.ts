/** Builds the text + photo payload ChatInput sends into useChat.sendMessage. */
export function chatSendPayload(
  text: string,
  imageUris: string[],
): { text: string; imageUris?: string[] } | null {
  const trimmed = text.trim();
  if (!trimmed && imageUris.length === 0) return null;
  const fallbackText = imageUris.length > 1 ? `📷 (${imageUris.length} photos)` : '📷';
  return {
    text: trimmed || fallbackText,
    imageUris: imageUris.length > 0 ? imageUris : undefined,
  };
}
