/**
 * ReactionBar — emoji reaction strip + comment count shown on milestone/memory cards
 * and in detail screens. Supports toggling the current user's reaction.
 */

import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { REACTION_EMOJIS, type ReactionSummary } from '@/services/reactions';

interface ReactionBarProps {
  reactions: ReactionSummary[];
  commentCount: number;
  currentUserId: string | null;
  canReact: boolean;
  onToggleReaction: (emoji: string) => Promise<void>;
  onAddComment?: (body: string) => Promise<void>;
  /** Show a compact summary row (for timeline cards) vs full picker (for detail screens) */
  compact?: boolean;
}

export function ReactionBar({
  reactions,
  commentCount,
  currentUserId,
  canReact,
  onToggleReaction,
  onAddComment,
  compact = false,
}: ReactionBarProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [showPicker, setShowPicker] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleReactionPress = async (emoji: string) => {
    if (!canReact || !currentUserId) return;
    setShowPicker(false);
    await onToggleReaction(emoji);
  };

  const handleCommentSubmit = async () => {
    if (!commentText.trim() || !onAddComment) return;
    setIsSaving(true);
    try {
      await onAddComment(commentText.trim());
      setCommentText('');
      setShowCommentInput(false);
    } finally {
      setIsSaving(false);
    }
  };

  const totalCount = reactions.reduce((acc, r) => acc + r.count, 0);
  const myReaction = reactions.find((r) => r.reactedByCurrentUser);

  if (compact) {
    return (
      <View style={styles.compactRow}>
        {reactions.map((r) => (
          <Pressable
            key={r.emoji}
            style={[
              styles.compactChip,
              {
                backgroundColor: r.reactedByCurrentUser
                  ? colors.primary + '20'
                  : colors.elevated,
                borderColor: r.reactedByCurrentUser ? colors.primary : 'transparent',
              },
            ]}
            onPress={() => handleReactionPress(r.emoji)}
            disabled={!canReact}>
            <Text style={styles.compactEmoji}>{r.emoji}</Text>
            <Text style={[styles.compactCount, { color: r.reactedByCurrentUser ? colors.primary : colors.muted }]}>
              {r.count}
            </Text>
          </Pressable>
        ))}
        {canReact && totalCount === 0 && (
          <Pressable
            style={[styles.compactAddButton, { borderColor: colors.border }]}
            onPress={() => setShowPicker(true)}>
            <Text style={[styles.compactAddText, { color: colors.muted }]}>+ React</Text>
          </Pressable>
        )}
        {totalCount > 0 && canReact && (
          <Pressable onPress={() => setShowPicker(true)} hitSlop={8}>
            <Text style={[styles.compactAddText, { color: colors.primary }]}>+</Text>
          </Pressable>
        )}
        {commentCount > 0 && (
          <Text style={[styles.compactCommentCount, { color: colors.muted }]}>
            💬 {commentCount}
          </Text>
        )}
        <EmojiPickerModal
          visible={showPicker}
          onClose={() => setShowPicker(false)}
          onSelect={handleReactionPress}
          currentEmoji={myReaction?.emoji}
          colors={colors}
        />
      </View>
    );
  }

  return (
    <View style={styles.fullContainer}>
      {/* Reaction strip */}
      <View style={styles.reactionStrip}>
        {REACTION_EMOJIS.map((emoji) => {
          const summary = reactions.find((r) => r.emoji === emoji);
          const active = summary?.reactedByCurrentUser ?? false;
          return (
            <Pressable
              key={emoji}
              style={[
                styles.emojiButton,
                {
                  backgroundColor: active ? colors.primary + '20' : colors.elevated,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              onPress={() => handleReactionPress(emoji)}
              disabled={!canReact || !currentUserId}>
              <Text style={styles.emojiText}>{emoji}</Text>
              {(summary?.count ?? 0) > 0 && (
                <Text style={[styles.emojiCount, { color: active ? colors.primary : colors.muted }]}>
                  {summary!.count}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Comment button */}
      {onAddComment && (
        <Pressable
          style={[styles.commentButton, { borderColor: colors.border }]}
          onPress={() => setShowCommentInput((v) => !v)}>
          <Text style={[styles.commentButtonText, { color: colors.muted }]}>
            💬 {commentCount > 0 ? `${commentCount} comment${commentCount > 1 ? 's' : ''}` : 'Add comment'}
          </Text>
        </Pressable>
      )}

      {/* Inline comment input */}
      {showCommentInput && onAddComment && (
        <View style={[styles.commentInputRow, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
          <TextInput
            style={[styles.commentInput, { color: colors.text }]}
            placeholder="Write a comment…"
            placeholderTextColor={colors.muted}
            value={commentText}
            onChangeText={setCommentText}
            maxLength={500}
            multiline
            autoFocus
          />
          <Pressable
            style={[styles.commentSubmit, { backgroundColor: colors.primary }, (!commentText.trim() || isSaving) && { opacity: 0.4 }]}
            onPress={handleCommentSubmit}
            disabled={!commentText.trim() || isSaving}>
            <Text style={styles.commentSubmitText}>Send</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function EmojiPickerModal({
  visible,
  onClose,
  onSelect,
  currentEmoji,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  currentEmoji?: string;
  colors: typeof Colors.light;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <View style={[styles.pickerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {REACTION_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              style={[
                styles.pickerEmoji,
                currentEmoji === emoji && { backgroundColor: colors.primary + '20', borderRadius: Radius.full },
              ]}
              onPress={() => onSelect(emoji)}>
              <Text style={styles.pickerEmojiText}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  compactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,  // raises to ~28px — acceptable for non-primary actions
    minHeight: 32,
  },
  compactEmoji: { fontSize: 15 },
  compactCount: { fontSize: 12, fontWeight: '700' },
  compactAddButton: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    minHeight: 32,
    justifyContent: 'center',
  },
  compactAddText: { fontSize: 12, fontWeight: '600' },
  compactCommentCount: { fontSize: 12 },
  fullContainer: { gap: Spacing.sm },
  reactionStrip: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  emojiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  emojiText: { fontSize: 18 },
  emojiCount: { fontSize: 12, fontWeight: '700' },
  commentButton: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  commentButtonText: { fontSize: 13, fontWeight: '600' },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  commentInput: { flex: 1, fontSize: 14, maxHeight: 80 },
  commentSubmit: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  commentSubmitText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCard: {
    flexDirection: 'row',
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.sm,
    gap: Spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  pickerEmoji: { padding: Spacing.sm },
  pickerEmojiText: { fontSize: 24 },
});
