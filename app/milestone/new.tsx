import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Fonts, MilestoneColors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useActiveChild } from '@/hooks/use-active-child';
import { useAppStore } from '@/store/app-store';
import { createMilestone } from '@/services/milestones';
import { uploadMilestoneMedia } from '@/services/media';
import { CATEGORY_LABELS, CATEGORY_EMOJIS } from '@/constants/milestone-templates';
import type { MilestoneCategory } from '@/lib/database.types';

const CATEGORIES: MilestoneCategory[] = ['word', 'steps', 'physical', 'custom'];

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

export default function NewMilestoneScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const { session } = useAuth();
  const { activeChild } = useActiveChild();
  const activeChildId = useAppStore((s) => s.activeChildId);

  const [category, setCategory] = useState<MilestoneCategory>('physical');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const accent = MilestoneColors[category];

  const pickPhoto = async () => {
    if (photos.length >= 5) {
      Alert.alert('Limit reached', 'You can add up to 5 photos per milestone.');
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
    if (!title.trim()) {
      Alert.alert('Title required', 'Give this milestone a name.');
      return;
    }
    const achievedAt = parseDateInput(date);
    if (!achievedAt) {
      Alert.alert('Invalid date', 'Enter the date as DD/MM/YYYY.');
      return;
    }
    if (!activeChildId || !session?.user.id) return;

    setIsLoading(true);
    try {
      const mediaUrls: string[] = [];
      for (const uri of photos) {
        const url = await uploadMilestoneMedia(activeChildId, uri);
        mediaUrls.push(url);
      }

      await createMilestone({
        childId: activeChildId,
        category,
        title: title.trim(),
        description: description.trim() || undefined,
        achievedAt,
        mediaUrls,
        userId: session.user.id,
      });

      router.back();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save milestone.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>
          New Milestone
        </Text>
        {activeChild && (
          <Text style={[styles.subtitle, { color: colors.muted }]}>for {activeChild.name}</Text>
        )}

        {/* Category */}
        <View>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Category</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((cat) => {
              const isActive = cat === category;
              const catAccent = MilestoneColors[cat];
              return (
                <Pressable
                  key={cat}
                  style={[
                    styles.categoryChip,
                    { backgroundColor: isActive ? catAccent : catAccent + '22' },
                  ]}
                  onPress={() => setCategory(cat)}>
                  <Text style={styles.categoryEmoji}>{CATEGORY_EMOJIS[cat]}</Text>
                  <Text style={[styles.categoryText, { color: isActive ? '#fff' : catAccent }]}>
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Title */}
        <View>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Title</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
            placeholder={`E.g. ${CATEGORY_EMOJIS[category]} First ${category}`}
            placeholderTextColor={colors.muted}
            value={title}
            onChangeText={setTitle}
            returnKeyType="next"
            autoFocus
          />
        </View>

        {/* Date */}
        <View>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Date achieved</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
            placeholder="DD/MM/YYYY"
            placeholderTextColor={colors.muted}
            value={date}
            onChangeText={(v) => setDate(formatDateInput(v))}
            keyboardType="numeric"
          />
        </View>

        {/* Description */}
        <View>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textarea, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
            placeholder="Tell the story..."
            placeholderTextColor={colors.muted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Photos */}
        <View>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Photos (up to 5)</Text>
          <View style={styles.photoRow}>
            {photos.map((uri, i) => (
              <Pressable key={i} onLongPress={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}>
                <Image source={{ uri }} style={styles.photoThumb} contentFit="cover" />
              </Pressable>
            ))}
            {photos.length < 5 && (
              <Pressable
                style={[styles.addPhotoButton, { backgroundColor: accent + '22' }]}
                onPress={pickPhoto}>
                <Text style={[styles.addPhotoIcon, { color: accent }]}>+</Text>
              </Pressable>
            )}
          </View>
          {photos.length > 0 && (
            <Text style={[styles.photoHint, { color: colors.muted }]}>Long-press a photo to remove</Text>
          )}
        </View>

        <Pressable
          style={[styles.saveButton, { backgroundColor: accent }, isLoading && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save milestone</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: 60,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: Spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    marginTop: -Spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    letterSpacing: 0.3,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryChip: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  categoryEmoji: { fontSize: 16 },
  categoryText: { fontSize: 14, fontWeight: '700' },
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
  saveButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: Spacing.sm,
  },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
