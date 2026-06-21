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
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const QUICK_LOG_CHIPS = [
  { id: 'wet', label: 'Wet nappy', text: 'Wet nappy', icon: 'water-outline' },
  { id: 'dirty', label: 'Dirty nappy', text: 'Dirty nappy', icon: 'alert-circle-outline' },
  { id: 'nap', label: 'Nap', text: 'Nap started', icon: 'moon-outline' },
  { id: 'awake', label: 'Woke up', text: 'Woke up', icon: 'sunny-outline' },
] as const;

interface ChatInputProps {
  onSend: (text: string, imageUri?: string) => void;
  onQuickLog: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, onQuickLog, disabled = false }: ChatInputProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow Milestones to access your photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && !imageUri) return;
    onSend(trimmed || '📷', imageUri ?? undefined);
    setText('');
    setImageUri(null);
  }, [text, imageUri, onSend]);

  const canSend = (text.trim().length > 0 || imageUri !== null) && !disabled;

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

      {imageUri && (
        <View style={styles.imagePreviewRow}>
          <View style={styles.imagePreviewWrapper}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" />
            <Pressable
              style={[styles.removeImageBtn, { backgroundColor: colors.background }]}
              onPress={() => setImageUri(null)}
              hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.inputRow}>
        <Pressable
          style={[styles.attachBtn, { backgroundColor: colors.inputBackground }]}
          onPress={pickImage}
          disabled={disabled}
          hitSlop={8}>
          <Ionicons name="attach" size={22} color={disabled ? colors.muted : colors.primary} />
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
  imagePreviewRow: {
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  imagePreviewWrapper: {
    alignSelf: 'flex-start',
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
