import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useActiveChild } from '@/hooks/use-active-child';
import { useBottomInset } from '@/components/shared/KeyboardSafeScreen';
import { VisitSummaryView } from '@/components/health/VisitSummaryView';
import { getErrorMessage } from '@/lib/error-message';
import { buildVisitSummary, type VisitSummaryInput, type VisitSummaryModel } from '@/lib/visit-summary';
import { exportAndSharePdf, loadVisitSummaryInput } from '@/services/pdf-export';

export default function VisitSummaryScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const bottomInset = useBottomInset();
  const { session } = useAuth();
  const { activeChild, isBootstrapping } = useActiveChild(session?.user.id ?? null);

  const [input, setInput] = useState<VisitSummaryInput | null>(null);
  const [model, setModel] = useState<VisitSummaryModel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeChild) {
      setInput(null);
      setModel(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const next = await loadVisitSummaryInput(activeChild);
      setInput(next);
      setModel(buildVisitSummary(next));
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to load the doctor visit summary.'));
    } finally {
      setIsLoading(false);
    }
  }, [activeChild]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleShare = async () => {
    if (!input || isSharing) return;
    setIsSharing(true);
    try {
      await exportAndSharePdf(input);
    } catch (e) {
      Alert.alert('Error', getErrorMessage(e, 'Failed to share the doctor visit summary.'));
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
        <View style={styles.headerText}>
          <Text
            style={[styles.headerTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}
            numberOfLines={1}>
            Visit summary
          </Text>
          {activeChild ? (
            <Text style={[styles.headerSubtitle, { color: colors.muted }]} numberOfLines={1}>
              {activeChild.name}
            </Text>
          ) : null}
        </View>
        <Pressable
          style={[
            styles.shareButton,
            { backgroundColor: colors.primary },
            (!model || isSharing) && styles.shareButtonDisabled,
          ]}
          onPress={() => void handleShare()}
          disabled={!model || isSharing}
          accessibilityRole="button"
          accessibilityLabel="Share PDF">
          {isSharing ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Ionicons name="share-outline" size={20} color={colors.onPrimary} />
          )}
        </Pressable>
      </View>

      {isBootstrapping || (isLoading && !model) ? (
        <View style={styles.centred}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !activeChild ? (
        <View style={styles.centred}>
          <Text style={styles.emptyEmoji}>🩺</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No child selected</Text>
        </View>
      ) : error && !model ? (
        <View style={styles.centred}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Could not load summary</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>{error}</Text>
          <Pressable
            style={[styles.retryButton, { borderColor: colors.primary }]}
            onPress={() => void load()}>
            <Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text>
          </Pressable>
        </View>
      ) : model ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Spacing.xxl + bottomInset },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isLoading && !!model}
              onRefresh={() => void load()}
              tintColor={colors.primary}
            />
          }>
          <VisitSummaryView model={model} colors={colors} />
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  backButton: { padding: Spacing.xs },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSubtitle: { fontSize: 13, marginTop: 1 },
  shareButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonDisabled: { opacity: 0.5 },
  scroll: {
    padding: Spacing.md,
  },
  emptyEmoji: { fontSize: 52, marginBottom: Spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  retryButton: {
    marginTop: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  retryText: { fontSize: 14, fontWeight: '700' },
});
