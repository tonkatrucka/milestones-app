import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import ViewShot from 'react-native-view-shot';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useActiveChild } from '@/hooks/use-active-child';
import { getMilestone } from '@/services/milestones';
import { ShareCard } from '@/components/sharing/ShareCard';
import { format, differenceInMonths } from 'date-fns';
import type { Milestone } from '@/lib/database.types';

function buildShareText(milestone: Milestone, childName: string, childDob: string): string {
  const months = differenceInMonths(new Date(milestone.achieved_at), new Date(childDob));
  const date = format(new Date(milestone.achieved_at), 'dd MMMM yyyy');
  return [
    `🌟 ${childName}'s Milestone`,
    ``,
    `${milestone.title}`,
    milestone.description ? milestone.description : '',
    ``,
    `📅 ${date} · ${months} months old`,
    ``,
    `Tracked with Milestones ✨`,
  ]
    .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
    .join('\n');
}

export default function ShareCardScreen() {
  const { milestoneId } = useLocalSearchParams<{ milestoneId: string }>();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const { session } = useAuth();
  const { activeChild } = useActiveChild(session?.user.id ?? null);

  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [isSavingToRoll, setIsSavingToRoll] = useState(false);

  const cardRef = useRef<ViewShot>(null);

  useEffect(() => {
    if (!milestoneId) return;
    getMilestone(milestoneId).then((m) => {
      setMilestone(m);
      setIsLoading(false);
    });
  }, [milestoneId]);

  const handleShare = async () => {
    if (!milestone || !activeChild) return;
    setIsSharing(true);
    try {
      const message = buildShareText(milestone, activeChild.name, activeChild.date_of_birth);
      await Share.share({
        message,
        title: `${activeChild.name}'s Milestone — ${milestone.title}`,
      });
    } catch {
      Alert.alert('Error', 'Unable to open share sheet.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleSaveToRoll = useCallback(async () => {
    if (!cardRef.current || !milestone) return;
    setIsSavingToRoll(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your photo library to save the card.');
        return;
      }
      // @ts-expect-error – ViewShot capture is typed differently across versions
      const uri: string = await cardRef.current.capture?.();
      if (!uri) { Alert.alert('Error', 'Could not capture card.'); return; }
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved!', 'Card saved to your camera roll.');
    } catch {
      Alert.alert('Error', 'Could not save to camera roll.');
    } finally {
      setIsSavingToRoll(false);
    }
  }, [milestone]);

  if (isLoading) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!milestone || !activeChild) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Could not load milestone.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.previewContainer}
        showsVerticalScrollIndicator={false}>
        <ViewShot ref={cardRef} options={{ format: 'jpg', quality: 0.95 }}>
          <ShareCard milestone={milestone} child={activeChild} />
        </ViewShot>
        <Text style={[styles.hint, { color: colors.muted }]}>
          Save to camera roll or share directly to Instagram, Messages, and more.
        </Text>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={[styles.saveButton, { backgroundColor: colors.elevated, borderColor: colors.border }, isSavingToRoll && { opacity: 0.7 }]}
          onPress={handleSaveToRoll}
          disabled={isSavingToRoll}>
          {isSavingToRoll
            ? <ActivityIndicator color={colors.text} />
            : <Text style={[styles.saveButtonText, { color: colors.text }]}>Save to camera roll 📸</Text>}
        </Pressable>
        <Pressable
          style={[styles.shareButton, { backgroundColor: colors.primary }, isSharing && { opacity: 0.7 }]}
          onPress={handleShare}
          disabled={isSharing}>
          {isSharing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.shareButtonText, { fontFamily: Fonts!.rounded }]}>
              Share ✨
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  previewContainer: {
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  footer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  saveButton: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.xl,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  saveButtonText: { fontSize: 15, fontWeight: '700' },
  shareButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
});
