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
import { pickImage } from '@/lib/pick-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Colors, Fonts, MilestoneColors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { parseCalendarDate } from '@/lib/calendar-date';
import { useAuth } from '@/hooks/use-auth';
import { useMemberRole } from '@/hooks/use-member-role';
import { useAppStore } from '@/store/app-store';
import { deleteMilestone, getMilestone, updateMilestone } from '@/services/milestones';
import { uploadMilestoneMedia } from '@/services/media';
import { CATEGORY_EMOJIS, CATEGORY_LABELS } from '@/constants/milestone-templates';
import type { Milestone, MilestoneCategory } from '@/lib/database.types';

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

function toDisplayDate(isoDate: string): string {
  return format(parseCalendarDate(isoDate), 'dd/MM/yyyy');
}

function isLocalUri(uri: string): boolean {
  return uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://');
}

export default function MilestoneDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const { session } = useAuth();
  const activeChildId = useAppStore((s) => s.activeChildId);
  const { canWrite } = useMemberRole(activeChildId, session?.user.id ?? null);

  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [category, setCategory] = useState<MilestoneCategory>('development');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [activePhoto, setActivePhoto] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const accent = MilestoneColors[category];

  useEffect(() => {
    if (!id) return;
    getMilestone(id).then((m) => {
      if (m) {
        setMilestone(m);
        setCategory(m.category as MilestoneCategory);
        setTitle(m.title);
        setDescription(m.description ?? '');
        setDate(toDisplayDate(m.achieved_at));
        setPhotos(m.media_urls);
      }
      setIsLoading(false);
    });
  }, [id]);

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

  const handleSave = async () => {
    if (!id || !activeChildId) return;
    if (!title.trim()) {
      Alert.alert('Title required', 'Give this milestone a name.');
      return;
    }
    const achievedAt = parseDateInput(date);
    if (!achievedAt) {
      Alert.alert('Invalid date', 'Enter the date as DD/MM/YYYY.');
      return;
    }

    setIsSaving(true);
    try {
      const mediaUrls: string[] = [];
      for (const uri of photos) {
        if (isLocalUri(uri)) {
          mediaUrls.push(await uploadMilestoneMedia(activeChildId, uri));
        } else {
          mediaUrls.push(uri);
        }
      }

      await updateMilestone(id, {
        category,
        title: title.trim(),
        description: description.trim() || undefined,
        achieved_at: achievedAt,
        media_urls: mediaUrls,
      });

      router.back();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save milestone.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete milestone', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          await deleteMilestone(id);
          router.back();
        },
      },
    ]);
  };

  const handleShare = () => {
    if (!id) return;
    router.push({ pathname: '/share/card' as any, params: { milestoneId: id } });
  };

  if (isLoading) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!milestone) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Milestone not found</Text>
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
                        i === activePhoto && { borderWidth: 2, borderColor: accent },
                      ]}
                      contentFit="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        ) : (
          <View style={[styles.heroPlaceholder, { backgroundColor: accent + '22' }]}>
            <Text style={styles.heroEmoji}>{CATEGORY_EMOJIS[category]}</Text>
          </View>
        )}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.form}>
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
                      onPress={canWrite ? () => setCategory(cat) : undefined}
                      disabled={!canWrite}>
                      <Text style={styles.categoryEmoji}>{CATEGORY_EMOJIS[cat]}</Text>
                      <Text style={[styles.categoryText, { color: isActive ? '#fff' : catAccent }]}>
                        {CATEGORY_LABELS[cat]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Title</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                value={title}
                onChangeText={setTitle}
                editable={canWrite}
              />
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Date achieved</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                value={date}
                onChangeText={(v) => setDate(formatDateInput(v))}
                keyboardType="numeric"
                placeholder="DD/MM/YYYY"
                placeholderTextColor={colors.muted}
                editable={canWrite}
              />
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Description</Text>
              <TextInput
                style={[styles.input, styles.textarea, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                placeholder="Tell the story..."
                placeholderTextColor={colors.muted}
                editable={canWrite}
              />
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Photos (up to 5)</Text>
              <View style={styles.photoRow}>
                {photos.map((uri, i) => (
                  <Pressable
                    key={`${uri}-${i}`}
                    onLongPress={
                      canWrite
                        ? () => {
                            setPhotos((p) => p.filter((_, idx) => idx !== i));
                            setActivePhoto(0);
                          }
                        : undefined
                    }>
                    <Image source={{ uri }} style={styles.photoThumb} contentFit="cover" />
                  </Pressable>
                ))}
                {canWrite && photos.length < 5 && (
                  <Pressable
                    style={[styles.addPhotoButton, { backgroundColor: accent + '22' }]}
                    onPress={pickPhoto}>
                    <Text style={[styles.addPhotoIcon, { color: accent }]}>+</Text>
                  </Pressable>
                )}
              </View>
              {canWrite && (
                <Text style={[styles.photoHint, { color: colors.muted }]}>Long-press a photo to remove</Text>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </ScrollView>

      <View style={[styles.actionBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {canWrite ? (
          <>
            <Pressable
              style={[styles.actionButton, { backgroundColor: accent }, isSaving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>Save changes</Text>
              )}
            </Pressable>
            <Pressable
              style={[styles.actionButtonSecondary, { borderColor: accent }]}
              onPress={handleShare}>
              <Text style={[styles.actionButtonSecondaryText, { color: accent }]}>Share</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButtonOutline, { borderColor: colors.danger }]}
              onPress={handleDelete}>
              <Text style={[styles.actionButtonOutlineText, { color: colors.danger }]}>Delete</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={[styles.actionButtonSecondary, { borderColor: accent }]}
            onPress={handleShare}>
            <Text style={[styles.actionButtonSecondaryText, { color: accent }]}>Share</Text>
          </Pressable>
        )}
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
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.xs,
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
  actionBar: {
    flexDirection: 'row',
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
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
    fontSize: 15,
  },
  actionButtonSecondary: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonSecondaryText: {
    fontWeight: '700',
    fontSize: 15,
  },
  actionButtonOutline: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonOutlineText: {
    fontWeight: '700',
    fontSize: 15,
  },
});
