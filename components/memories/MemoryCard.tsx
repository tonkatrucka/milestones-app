import { Pressable, StyleSheet, Text, View } from 'react-native';
import { format, parseISO } from 'date-fns';
import { ResolvedImage } from '@/components/media/ResolvedImage';
import { Colors, Fonts, MemoryColor, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Memory } from '@/lib/database.types';

const MEMORY_EMOJIS = ['📸', '✨', '💜', '🌈', '🎈', '🎉', '🏖️', '🧸'];

function emojiForMemory(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % MEMORY_EMOJIS.length;
  return MEMORY_EMOJIS[hash];
}

interface MemoryCardProps {
  memory: Memory;
  onPress: () => void;
  variant?: 'compact' | 'featured';
}

export function MemoryCard({ memory, onPress, variant = 'featured' }: MemoryCardProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const photo = memory.media_urls[0];
  const emoji = emojiForMemory(memory.id);
  const isFeatured = variant === 'featured';

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={onPress}
      android_ripple={{ color: MemoryColor + '22' }}>
      {photo ? (
        <ResolvedImage
          stored={photo}
          style={isFeatured ? styles.heroPhoto : styles.thumbPhoto}
          contentFit="cover"
        />
      ) : (
        <View style={[isFeatured ? styles.heroPlaceholder : styles.thumbPlaceholder, { backgroundColor: MemoryColor + '18' }]}>
          <Text style={styles.placeholderEmoji}>{emoji}</Text>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={[styles.chip, { backgroundColor: MemoryColor + '22' }]}>
            <Text style={[styles.chipText, { color: MemoryColor }]}>📸 Memory</Text>
          </View>
          <Text style={[styles.date, { color: colors.muted }]}>
            {format(parseISO(memory.occurred_at), isFeatured ? 'EEE d MMM yyyy' : 'd MMM yyyy')}
          </Text>
        </View>

        <Text
          style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}
          numberOfLines={isFeatured ? 2 : 2}>
          {memory.title}
        </Text>

        {memory.description ? (
          <Text style={[styles.description, { color: colors.muted }]} numberOfLines={isFeatured ? 3 : 2}>
            {memory.description}
          </Text>
        ) : null}

        {memory.tags.length > 0 ? (
          <View style={styles.tagRow}>
            {memory.tags.slice(0, 3).map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: MemoryColor + '15' }]}>
                <Text style={[styles.tagText, { color: MemoryColor }]}>{tag}</Text>
              </View>
            ))}
            {memory.tags.length > 3 ? (
              <Text style={[styles.moreTags, { color: colors.muted }]}>+{memory.tags.length - 3}</Text>
            ) : null}
          </View>
        ) : null}

        {memory.media_urls.length > 1 ? (
          <Text style={[styles.photoCount, { color: MemoryColor }]}>
            {memory.media_urls.length} photos
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  heroPhoto: {
    width: '100%',
    height: 180,
  },
  thumbPhoto: {
    width: '100%',
    height: 120,
  },
  heroPlaceholder: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholder: {
    width: '100%',
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 48,
  },
  body: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  chip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  date: {
    fontSize: 12,
    flexShrink: 1,
    textAlign: 'right',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    alignItems: 'center',
    marginTop: 2,
  },
  tag: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  moreTags: {
    fontSize: 11,
    fontWeight: '600',
  },
  photoCount: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
});
