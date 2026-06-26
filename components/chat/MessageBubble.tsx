import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { format, parseISO } from 'date-fns';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ChatMessage } from '@/lib/database.types';

interface MessageBubbleProps {
  message: ChatMessage;
}

function formatMessageTime(createdAt: string): string {
  try {
    return format(parseISO(createdAt), 'h:mm a');
  } catch {
    return '';
  }
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const isUser = message.role === 'user';
  const photos = message.media_urls;
  const timestamp = formatMessageTime(message.created_at);

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
          <Text style={styles.avatarEmoji}>✨</Text>
        </View>
      )}

      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: colors.primary }]
            : [styles.bubbleAssistant, { backgroundColor: colors.card }],
        ]}>
        {photos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoRow}
            style={photos.length === 1 ? styles.photoScrollSingle : styles.photoScrollMulti}>
            {photos.map((uri, index) => (
              <Image
                key={`${uri}-${index}`}
                source={{ uri }}
                style={photos.length === 1 ? styles.photoSingle : styles.photoThumb}
                contentFit="cover"
              />
            ))}
          </ScrollView>
        ) : null}
        <View style={styles.bubbleBody}>
          <Text
            style={[
              styles.text,
              isUser
                ? [styles.textUser, { color: colors.onPrimary }]
                : [styles.textAssistant, { color: colors.text }],
            ]}>
            {message.content}
          </Text>
          {timestamp ? (
            <Text
              style={[
                styles.timestamp,
                isUser
                  ? [styles.timestampUser, { color: colors.onPrimary + 'BF' }]
                  : { color: colors.muted },
              ]}>
              {timestamp}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function TypingIndicator() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  return (
    <View style={[styles.row, styles.rowAssistant]}>
      <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
        <Text style={styles.avatarEmoji}>✨</Text>
      </View>
      <View style={[styles.bubble, styles.bubbleAssistant, { backgroundColor: colors.card }]}>
        <ActivityIndicator size="small" color={colors.primary} style={styles.typingSpinner} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAssistant: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarEmoji: {
    fontSize: 16,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    borderBottomLeftRadius: 4,
  },
  photoScrollSingle: {
    maxWidth: '100%',
  },
  photoScrollMulti: {
    maxWidth: '100%',
  },
  photoRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    padding: Spacing.xs,
  },
  photoSingle: {
    width: 220,
    height: 160,
    borderRadius: Radius.md,
  },
  photoThumb: {
    width: 88,
    height: 88,
    borderRadius: Radius.md,
  },
  bubbleBody: {
    paddingHorizontal: Spacing.sm + 4,
    paddingTop: Spacing.sm + 4,
    paddingBottom: Spacing.xs + 2,
    gap: 2,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Fonts?.sans,
  },
  textUser: {},
  textAssistant: {},
  timestamp: {
    fontSize: 10,
    lineHeight: 12,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  timestampUser: {},
  typingSpinner: {
    padding: Spacing.sm + 4,
  },
});
