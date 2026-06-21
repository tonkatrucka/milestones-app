import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { Colors, Fonts, MemoryColor, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useActiveChild } from '@/hooks/use-active-child';
import { useAppStore } from '@/store/app-store';
import { deleteMemory, getMemory, updateMemory } from '@/services/memories';
import { uploadMemoryMedia } from '@/services/media';
import type { Memory } from '@/lib/database.types';

function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDateInput(value: string): string | null {
  const parts = value.split('/');
  if (parts.length !== 3 || parts[2].length !== 4) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function toDisplayDate(isoDate: string): string {
  const d = parseISO(isoDate);
  return format(d, 'dd/MM/yyyy');
}

function isLocalUri(uri: string): boolean {
  return uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://');
}

export default function MemoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const { session } = useAuth();
  const { activeChild } = useActiveChild(session?.user.id ?? null);
  const activeChildId = useAppStore((s) => s.activeChildId);

  const [memory, setMemory] = useState<Memory | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [date, setDate] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [activePhoto, setActivePhoto] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getMemory(id).then((m) => {
      if (m) {
        setMemory(m);
        setTitle(m.title);
        setDescription(m.description ?? '');
        setTags(m.tags.join(', '));
        setDate(toDisplayDate(m.occurred_at));
        setPhotos(m.media_urls);
      }
      setIsLoading(false);
    });
  }, [id]);

  const pickPhoto = async () => {
    if (photos.length >= 5) {
      Alert.alert('Limit reached', 'You can add up to 5 photos per memory.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow Milestones to access your photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5 - photos.length,
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 5));
    }
  };

  const handleSave = async () => {
    if (!id || !activeChildId) return;
    if (!title.trim()) {
      Alert.alert('Title required', 'Give this memory a name.');
      return;
    }
    const occurredAt = parseDateInput(date);
    if (!occurredAt) {
      Alert.alert('Invalid date', 'Enter the date as DD/MM/YYYY.');
      return;
    }

    setIsSaving(true);
    try {
      const mediaUrls: string[] = [];
      for (const uri of photos) {
        if (isLocalUri(uri)) {
          mediaUrls.push(await uploadMemoryMedia(activeChildId, uri));
        } else {
          mediaUrls.push(uri);
        }
      }

      const updated = await updateMemory(id, {
        title: title.trim(),
        description: description.trim() || undefined,
        occurred_at: occurredAt,
        tags: parseTags(tags),
        media_urls: mediaUrls,
      });

      setMemory(updated);
      setPhotos(updated.media_urls);
      router.back();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save memory.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete memory', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          await deleteMemory(id);
          router.back();
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={MemoryColor} />
      </View>
    );
  }

  if (!memory) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Memory not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {photos.length > 0 ? (
          <View>
            <Image
              source={{ uri: photos[activePhoto] }}
              style={styles.heroImage}
              contentFit="cover"
            />
            {photos.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
                {photos.map((url, i) => (
                  <Pressable key={`${url}-${i}`} onPress={() => setActivePhoto(i)}>
                    <Image
                      source={{ uri: url }}
                      style={[
                        styles.thumb,
                        i === activePhoto && { borderWidth: 2, borderColor: MemoryColor },
                      ]}
                      contentFit="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        ) : (
          <View style={[styles.heroPlaceholder, { backgroundColor: MemoryColor + '18' }]}>
            <Text style={styles.heroEmoji}>📸</Text>
          </View>
        )}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.form}>
            <View style={[styles.chip, { backgroundColor: MemoryColor + '22' }]}>
              <Text style={[styles.chipText, { color: MemoryColor }]}>📸 Memory</Text>
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Title</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>When did it happen?</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                value={date}
                onChangeText={(v) => setDate(formatDateInput(v))}
                keyboardType="numeric"
                placeholder="DD/MM/YYYY"
                placeholderTextColor={colors.muted}
              />
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Story</Text>
              <TextInput
                style={[styles.input, styles.textarea, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                placeholder="What made this moment special?"
                placeholderTextColor={colors.muted}
              />
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Tags</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                value={tags}
                onChangeText={setTags}
                placeholder="family, travel, birthday"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
              />
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Photos (up to 5)</Text>
              <View style={styles.photoRow}>
                {photos.map((uri, i) => (
                  <Pressable
                    key={`${uri}-${i}`}
                    onLongPress={() => {
                      setPhotos((p) => p.filter((_, idx) => idx !== i));
                      setActivePhoto(0);
                    }}>
                    <Image source={{ uri }} style={styles.photoThumb} contentFit="cover" />
                  </Pressable>
                ))}
                {photos.length < 5 && (
                  <Pressable
                    style={[styles.addPhotoButton, { backgroundColor: MemoryColor + '22' }]}
                    onPress={pickPhoto}>
                    <Text style={[styles.addPhotoIcon, { color: MemoryColor }]}>+</Text>
                  </Pressable>
                )}
              </View>
              <Text style={[styles.photoHint, { color: colors.muted }]}>Long-press a photo to remove</Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ScrollView>

      <View style={[styles.actionBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: MemoryColor }, isSaving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.actionButtonText}>Save changes</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.actionButtonOutline, { borderColor: colors.danger }]}
          onPress={handleDelete}>
          <Text style={[styles.actionButtonOutlineText, { color: colors.danger }]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  heroImage: { width: '100%', height: 260 },
  heroPlaceholder: {
    width: '100%',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 64 },
  thumbRow: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: Radius.sm,
  },
  form: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  chip: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  input: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 15,
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: Radius.md,
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoIcon: { fontSize: 32, lineHeight: 36 },
  photoHint: { fontSize: 12, marginTop: Spacing.xs },
  actionBar: {
    flexDirection: 'row',
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionButton: {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  actionButtonOutline: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonOutlineText: {
    fontWeight: '700',
    fontSize: 16,
  },
});
