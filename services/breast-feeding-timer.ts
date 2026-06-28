import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { differenceInMinutes } from 'date-fns';
import type { BreastSide } from '@/lib/database.types';
import { formatBreastSide } from '@/lib/meal-format';
import { useBreastFeedingStore } from '@/store/breast-feeding-store';
import {
  endBreastfeedingLiveActivity,
  reconcileBreastfeedingLiveActivity,
  startBreastfeedingLiveActivity,
} from '@/services/breast-feeding-live-activity';

const NOTIFICATION_ID = 'breastfeeding-active';
let syncInterval: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

export function configureBreastFeedingNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export function formatBreastfeedingElapsed(startedAt: string): string {
  const mins = Math.max(0, differenceInMinutes(new Date(), new Date(startedAt)));
  if (mins < 1) return 'just now';
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins}m`;
}

export function getElapsedMins(startedAt: string): number {
  return Math.max(1, differenceInMinutes(new Date(), new Date(startedAt)));
}

function liveActivityProps(side: BreastSide, startedAt: string) {
  return {
    startedAtMs: Date.parse(startedAt),
    sideLabel: formatBreastSide(side),
  };
}

async function presentBreastfeedingNotification(side: BreastSide, startedAt: string) {
  const sideLabel = formatBreastSide(side);
  const elapsed = formatBreastfeedingElapsed(startedAt);
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: {
      title: `Breastfeeding · ${sideLabel}`,
      body: `Elapsed: ${elapsed}`,
      sticky: Platform.OS === 'android',
      data: { type: 'breastfeeding' },
    },
    trigger: null,
  });
}

async function dismissBreastfeedingNotification() {
  await Notifications.dismissNotificationAsync(NOTIFICATION_ID).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(() => {});
}

export async function syncBreastfeedingNotification() {
  if (Platform.OS === 'ios') return;
  const session = useBreastFeedingStore.getState().session;
  if (!session) return;
  await presentBreastfeedingNotification(session.side, session.startedAt);
}

function startSyncLoop() {
  if (Platform.OS === 'ios') return;
  stopSyncLoop();
  syncInterval = setInterval(() => {
    void syncBreastfeedingNotification();
  }, 30_000);
}

function stopSyncLoop() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

async function presentSessionIndicator(side: BreastSide, startedAt: string) {
  if (Platform.OS === 'ios') {
    const started = startBreastfeedingLiveActivity(liveActivityProps(side, startedAt));
    if (started) return true;
  }

  const granted = await requestNotificationPermissions();
  if (!granted) return false;
  await presentBreastfeedingNotification(side, startedAt);
  startSyncLoop();
  return true;
}

async function dismissSessionIndicator() {
  if (Platform.OS === 'ios') {
    endBreastfeedingLiveActivity();
    return;
  }
  stopSyncLoop();
  await dismissBreastfeedingNotification();
}

export function reconcileBreastfeedingSessionIndicator() {
  const session = useBreastFeedingStore.getState().session;
  if (!session) return;

  if (Platform.OS === 'ios') {
    reconcileBreastfeedingLiveActivity(liveActivityProps(session.side, session.startedAt));
    return;
  }

  if (!syncInterval) startSyncLoop();
}

export function initBreastFeedingTimerListeners() {
  if (appStateSubscription) return;
  appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      reconcileBreastfeedingSessionIndicator();
      if (Platform.OS !== 'ios') void syncBreastfeedingNotification();
    }
  });
  reconcileBreastfeedingSessionIndicator();
}

export function getActiveBreastFeedingSession(childId: string | null) {
  const session = useBreastFeedingStore.getState().session;
  if (!session || !childId || session.childId !== childId) return null;
  return session;
}

export async function startBreastFeedingSession(
  childId: string,
  side: BreastSide,
): Promise<{ ok: true } | { ok: false; reason: 'permission_denied' }> {
  const startedAt = new Date().toISOString();
  useBreastFeedingStore.getState().setSession({ childId, startedAt, side });

  const shown = await presentSessionIndicator(side, startedAt);
  if (!shown) {
    useBreastFeedingStore.getState().setSession(null);
    return { ok: false, reason: 'permission_denied' };
  }

  return { ok: true };
}

export async function stopBreastFeedingSession() {
  const session = useBreastFeedingStore.getState().session;
  if (!session) return null;

  const result = {
    startedAt: new Date(session.startedAt),
    side: session.side,
    durationMins: getElapsedMins(session.startedAt),
  };

  useBreastFeedingStore.getState().setSession(null);
  await dismissSessionIndicator();
  return result;
}
