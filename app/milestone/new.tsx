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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { differenceInMonths } from 'date-fns';
import { pickImage } from '@/lib/pick-image';
import { Colors, Fonts, MilestoneColors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useActiveChild } from '@/hooks/use-active-child';
import { useRequireCanWrite } from '@/hooks/use-member-role';
import { useAppStore } from '@/store/app-store';
import { createMilestone } from '@/services/milestones';
import { uploadMilestoneMedia, uploadAudioNote } from '@/services/media';
import { CATEGORY_LABELS, CATEGORY_EMOJIS, getSuggestionsForAge } from '@/constants/milestone-templates';
import { VoiceRecorder } from '@/components/shared/VoiceRecorder';
import type { MilestoneCategory } from '@/lib/database.types';

const CATEGORIES: MilestoneCategory[] = ['language', 'movement', 'development'];

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
  const params = useLocalSearchParams<{ title?: string; category?: MilestoneCategory }>();
  const { session } = useAuth();
  const { activeChild } = useActiveChild(session?.user.id ?? null);
  const activeChildId = useAppStore((s) => s.activeChildId);
  useRequireCanWrite(activeChildId, session?.user.id ?? null);

  const [category, setCategory] = useState<MilestoneCategory>(params.category ?? 'development');
  const [title, setTitle] = useState(params.title ?? '');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [audioLocalUri, setAudioLocalUri] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);

  const accent = MilestoneColors[category];

  const ageMonths = activeChild
    ? differenceInMonths(new Date(), new Date(activeChild.date_of_birth))
    : null;

  const suggestions = ageMonths !== null ? getSuggestionsForAge(ageMonths, category) : [];

  const pickPhoto = async () => {
    if (photos.length >= 5) {
      Alert.alert('Limit reached', 'You can add up to 5 photos per milestone.');
      return;
    }
    const uris = await pickImage({
      allowsMultipleSelection: true,
      selectionLimit: 5 - photos.length,
      quality: 0.8,
    });
    if (uris) {
      setPhotos((prev) => [...prev, ...uris].slice(0, 5));
    }
  };

  const generateStory = async () => {
    if (!title.trim() || !activeChild) return;
    setIsGeneratingStory(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const res = await supabase.functions.invoke('generate-milestone-story', {
        body: {
          childName: activeChild.name,
          childDob: activeChild.date_of_birth,
          milestoneTitle: title.trim(),
          milestoneCategory: category,
          date: parseDateInput(date) ?? new Date().toISOString().split('T')[0],
          notes: description.trim() || undefined,
        },
      });
      if (res.data?.story) {
        setDescription(res.data.story);
      }
    } catch {
      Alert.alert('Error', 'Could not generate story. You can write your own!');
    } finally {
      setIsGeneratingStory(false);
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

      let audioUrl: string | undefined;
      if (audioLocalUri) {
        audioUrl = await uploadAudioNote(activeChildId, audioLocalUri);
      }

      await createMilestone({
        childId: activeChildId,
        category,
        title: title.trim(),
        description: description.trim() || undefined,
        achievedAt,
        mediaUrls,
        audioUrl,
        isPrivate,
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

        {/* Template suggestions for current age */}
        {suggestions.length > 0 && (
          <View>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>
              Suggestions for {ageMonths} month{ageMonths !== 1 ? 's' : ''}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.suggestionRow}>
                {suggestions.map((s, i) => (
                  <Pressable
                    key={i}
                    style={[styles.suggestionChip, { backgroundColor: accent + '18', borderColor: accent + '40' }]}
                    onPress={() => setTitle(s.title)}>
                    <Text style={styles.suggestionEmoji}>{s.emoji}</Text>
                    <Text style={[styles.suggestionText, { color: accent }]}>{s.title}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

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

        {/* Description + AI story */}
        <View>
          <View style={styles.fieldLabelRow}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Story (optional)</Text>
            {title.trim().length > 0 && (
              <Pressable
                style={[styles.aiButton, { borderColor: accent }]}
                onPress={generateStory}
                disabled={isGeneratingStory}>
                {isGeneratingStory
                  ? <ActivityIndicator size="small" color={accent} />
                  : <Text style={[styles.aiButtonText, { color: accent }]}>✨ Write story</Text>}
              </Pressable>
            )}
          </View>
          <TextInput
            style={[styles.input, styles.textarea, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
            placeholder="What happened? How did it feel?"
            placeholderTextColor={colors.muted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Voice note */}
        <View>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Voice note (optional)</Text>
          <VoiceRecorder
            onRecordingComplete={setAudioLocalUri}
            onRecordingDeleted={() => setAudioLocalUri(null)}
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

        {/* Private toggle */}
        <Pressable
          style={[styles.privateToggle, { borderColor: colors.border, backgroundColor: isPrivate ? colors.primary + '15' : colors.elevated }]}
          onPress={() => setIsPrivate((v) => !v)}>
          <Text style={styles.privateEmoji}>{isPrivate ? '🔒' : '👁️'}</Text>
          <View style={styles.privateInfo}>
            <Text style={[styles.privateTitle, { color: colors.text }]}>
              {isPrivate ? 'Private milestone' : 'Shared with team'}
            </Text>
            <Text style={[styles.privateSubtitle, { color: colors.muted }]}>
              {isPrivate ? 'Only you can see this' : 'Visible to all caregivers and viewers'}
            </Text>
          </View>
        </Pressable>

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
  container: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 60 },
  title: { fontSize: 26, fontWeight: '800', marginTop: Spacing.sm },
  subtitle: { fontSize: 15, marginTop: -Spacing.md },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.xs, letterSpacing: 0.3 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  categoryChip: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  categoryEmoji: { fontSize: 16 },
  categoryText: { fontSize: 14, fontWeight: '700' },
  suggestionRow: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: Spacing.xs },
  suggestionChip: { borderRadius: Radius.full, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  suggestionEmoji: { fontSize: 14 },
  suggestionText: { fontSize: 12, fontWeight: '600' },
  aiButton: { borderRadius: Radius.full, borderWidth: 1.5, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  aiButtonText: { fontSize: 12, fontWeight: '700' },
  input: { borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: 15 },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  photoThumb: { width: 80, height: 80, borderRadius: Radius.md },
  addPhotoButton: { width: 80, height: 80, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  addPhotoIcon: { fontSize: 32, lineHeight: 36 },
  photoHint: { fontSize: 12, marginTop: Spacing.xs },
  privateToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md },
  privateEmoji: { fontSize: 22 },
  privateInfo: { flex: 1 },
  privateTitle: { fontSize: 14, fontWeight: '600' },
  privateSubtitle: { fontSize: 12, marginTop: 2 },
  saveButton: { borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center', minHeight: 52, marginTop: Spacing.sm },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
