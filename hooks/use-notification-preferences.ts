import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import type { NotificationPreferences } from '@/lib/database.types';
import {
  fetchNotificationPreferences,
  registerPushToken,
  requestPushPermission,
  upsertNotificationPreferences,
} from '@/services/push-notifications';

type PreferenceKey = 'notify_activities' | 'notify_memories' | 'notify_milestones';

const DEFAULT_PREFS = (userId: string): NotificationPreferences => ({
  user_id: userId,
  notify_activities: false,
  notify_memories: false,
  notify_milestones: false,
  updated_at: new Date().toISOString(),
});

export function useNotificationPreferences(userId: string | null) {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(Platform.OS !== 'web');

  const refresh = useCallback(async () => {
    if (!userId) {
      setPrefs(null);
      return;
    }
    setIsLoading(true);
    try {
      const data = await fetchNotificationPreferences(userId);
      setPrefs(data);
    } catch (e) {
      console.error('[useNotificationPreferences] load failed:', e);
      setPrefs(DEFAULT_PREFS(userId));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId || Platform.OS === 'web') return;
    registerPushToken(userId)
      .then(setPushEnabled)
      .catch(() => setPushEnabled(false));
  }, [userId]);

  const setPreference = useCallback(
    async (key: PreferenceKey, value: boolean) => {
      if (!userId || !prefs) return;

      if (value && Platform.OS !== 'web') {
        const granted = await requestPushPermission();
        if (!granted) {
          Alert.alert(
            'Notifications disabled',
            'Enable notifications in your device settings to receive alerts from your team.',
          );
          return;
        }
        const registered = await registerPushToken(userId);
        setPushEnabled(registered);
        if (!registered) {
          Alert.alert(
            'Could not enable push',
            'Push notifications are only available on a physical device with a development or production build.',
          );
          return;
        }
      }

      const previous = prefs;
      const optimistic = { ...prefs, [key]: value };
      setPrefs(optimistic);
      setIsSaving(true);

      try {
        const saved = await upsertNotificationPreferences(userId, { [key]: value });
        setPrefs(saved);
      } catch (e) {
        setPrefs(previous);
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save notification preference.');
      } finally {
        setIsSaving(false);
      }
    },
    [prefs, userId],
  );

  return {
    prefs,
    isLoading,
    isSaving,
    pushEnabled,
    setPreference,
    refresh,
  };
}
