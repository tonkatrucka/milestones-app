import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { pickImage } from '@/lib/pick-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MAX_CHAT_PHOTOS } from '@/services/chat';

const QUICK_LOG_CHIPS = [
  { id: 'wet', label: 'Wet nappy', text: 'Wet nappy', icon: 'water-outline' },
  { id: 'dirty', label: 'Dirty nappy', text: 'Dirty nappy', icon: 'alert-circle-outline' },
  { id: 'nap', label: 'Nap', text: 'Nap started', icon: 'moon-outline' },
  { id: 'awake', label: 'Woke up', text: 'Woke up', icon: 'sunny-outline' },
] as const;

interface ChatInputProps {
  onSend: (text: string, imageUris?: string[]) => void;
  onQuickLog: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, onQuickLog, disabled = false }: ChatInputProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [text, setText] = useState('');
  const [imageUris, setImageUris] = useState<string[]>([]);

  const pickImages = useCallback(async () => {
    if (imageUris.length >= MAX_CHAT_PHOTOS) {
      Alert.alert('Limit reached', `You can attach up to ${MAX_CHAT_PHOTOS} photos per message.`);
      return;
    }
    const uris = await pickImage({
      allowsMultipleSelection: true,
      selectionLimit: MAX_CHAT_PHOTOS - imageUris.length,
      quality: 0.8,
    });
    if (uris) {
      setImageUris((prev) => [...prev, ...uris].slice(0, MAX_CHAT_PHOTOS));
    }
  }, [imageUris.length]);

  const removeImage = useCallback((index: number) => {
    setImageUris((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && imageUris.length === 0) return;
    const fallbackText =
      imageUris.length > 1 ? `📷 (${imageUris.length} photos)` : '📷';
    onSend(trimmed || fallbackText, imageUris.length > 0 ? imageUris : undefined);
    setText('');
    setImageUris([]);
  }, [text, imageUris, onSend]);

  const canSend = (text.trim().length > 0 || imageUris.length > 0) && !disabled;
  const atPhotoLimit = imageUris.length >= MAX_CHAT_PHOTOS;

  return (
    <View style={styles.container}>
      {/* Quick-log chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsScroll}>
        {QUICK_LOG_CHIPS.map((chip) => (
          <Pressable
            key={chip.id}
            style={[styles.chip, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            onPress={() => onQuickLog(chip.text)}
            disabled={disabled}
            hitSlop={4}>
            <Ionicons
              name={chip.icon as 'water-outline'}
              size={13}
              color={disabled ? colors.muted : colors.primary}
            />
            <Text style={[styles.chipLabel, { color: disabled ? colors.muted : colors.text }]}>
              {chip.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {imageUris.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.imagePreviewRow}
          style={styles.imagePreviewScroll}>
          {imageUris.map((uri, index) => (
            <View key={`${uri}-${index}`} style={styles.imagePreviewWrapper}>
              <Image source={{ uri }} style={styles.imagePreview} contentFit="cover" />
              <Pressable
                style={[styles.removeImageBtn, { backgroundColor: colors.background }]}
                onPress={() => removeImage(index)}
                hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.inputRow}>
        <Pressable
          style={[styles.attachBtn, { backgroundColor: colors.inputBackground }]}
          onPress={pickImages}
          disabled={disabled || atPhotoLimit}
          hitSlop={8}>
          <Ionicons
            name="attach"
            size={22}
            color={disabled || atPhotoLimit ? colors.muted : colors.primary}
          />
        </Pressable>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.inputBackground,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="Tell me what's happening…"
          placeholderTextColor={colors.muted}
          value={text}
          onChangeText={setText}
          maxLength={1000}
          editable={!disabled}
          returnKeyType="send"
          blurOnSubmit={false}
          submitBehavior="submit"
          onSubmitEditing={() => {
            if (canSend) handleSend();
          }}
        />

        <Pressable
          style={[
            styles.sendBtn,
            { backgroundColor: canSend ? colors.primary : colors.inputBackground },
          ]}
          onPress={handleSend}
          disabled={!canSend}
          hitSlop={8}>
          {disabled ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="send" size={18} color={canSend ? '#fff' : colors.muted} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  chipsScroll: {
    marginBottom: Spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  imagePreviewScroll: {
    marginBottom: Spacing.sm,
  },
  imagePreviewRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  imagePreviewWrapper: {
    position: 'relative',
  },
  imagePreview: {
    width: 72,
    height: 72,
    borderRadius: Radius.md,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    borderRadius: 10,
    padding: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
    lineHeight: 20,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
