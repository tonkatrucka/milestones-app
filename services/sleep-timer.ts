import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { formatSessionElapsed } from '@/lib/session-elapsed';
import {
  endSleepingLiveActivity,
  reconcileSleepingLiveActivity,
  startSleepingLiveActivity,
} from '@/services/sleep-live-activity';
import { useSleepTimerStore, type SleepTimerSession } from '@/store/sleep-timer-store';

const NOTIFICATION_ID = 'sleep-active';
let syncInterval: ReturnType<typeof setInterval> | null = null;
let sleepAppStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

function liveActivityProps(startedAt: string) {
  return { startedAtMs: Date.parse(startedAt) };
}

async function presentSleepNotification(startedAt: string) {
  const elapsed = formatSessionElapsed(startedAt);
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: {
      title: 'Sleeping',
      body: `Elapsed: ${elapsed}`,
      sticky: Platform.OS === 'android',
      data: { type: 'sleep' },
    },
    trigger: null,
  });
}

async function dismissSleepNotification() {
  await Notifications.dismissNotificationAsync(NOTIFICATION_ID).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(() => {});
}

export async function syncSleepNotification() {
  if (Platform.OS === 'ios') return;
  const session = useSleepTimerStore.getState().session;
  if (!session) return;
  await presentSleepNotification(session.startedAt);
}

function startSyncLoop() {
  if (Platform.OS === 'ios') return;
  stopSyncLoop();
  syncInterval = setInterval(() => {
    void syncSleepNotification();
  }, 30_000);
}

function stopSyncLoop() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function presentSessionIndicator(startedAt: string) {
  if (Platform.OS === 'ios') {
    const started = startSleepingLiveActivity(liveActivityProps(startedAt));
    if (started) return true;
  }

  const granted = await requestNotificationPermissions();
  if (!granted) return false;
  await presentSleepNotification(startedAt);
  startSyncLoop();
  return true;
}

async function dismissSessionIndicator() {
  if (Platform.OS === 'ios') {
    endSleepingLiveActivity();
    return;
  }
  stopSyncLoop();
  await dismissSleepNotification();
}

export function reconcileSleepSessionIndicator() {
  const session = useSleepTimerStore.getState().session;
  if (!session) return;

  if (Platform.OS === 'ios') {
    reconcileSleepingLiveActivity(liveActivityProps(session.startedAt));
    return;
  }

  if (!syncInterval) startSyncLoop();
}

export function initSleepTimerListeners() {
  if (sleepAppStateSubscription) return;
  sleepAppStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      reconcileSleepSessionIndicator();
      if (Platform.OS !== 'ios') void syncSleepNotification();
    }
  });
  reconcileSleepSessionIndicator();
}

export async function startSleepTimer(
  childId: string,
  eventId: string,
  startedAt: string,
): Promise<{ ok: true } | { ok: false; reason: 'permission_denied' }> {
  useSleepTimerStore.getState().setSession({ childId, eventId, startedAt });

  const shown = await presentSessionIndicator(startedAt);
  if (!shown) {
    useSleepTimerStore.getState().setSession(null);
    return { ok: false, reason: 'permission_denied' };
  }

  return { ok: true };
}

export async function stopSleepTimer() {
  useSleepTimerStore.getState().setSession(null);
  await dismissSessionIndicator();
}

export async function syncSleepTimerWithOpenEvent(
  childId: string | null,
  openSleep: { id: string; occurred_at: string; metadata: { sleepEnd?: string } } | null,
) {
  const session = useSleepTimerStore.getState().session;

  if (!childId || !openSleep || openSleep.metadata.sleepEnd) {
    if (session) await stopSleepTimer();
    return;
  }

  if (
    session?.childId === childId &&
    session.eventId === openSleep.id &&
    session.startedAt === openSleep.occurred_at
  ) {
    reconcileSleepSessionIndicator();
    return;
  }

  await startSleepTimer(childId, openSleep.id, openSleep.occurred_at);
}

export function getActiveSleepTimerSession(childId: string | null): SleepTimerSession | null {
  const session = useSleepTimerStore.getState().session;
  if (!session || !childId || session.childId !== childId) return null;
  return session;
}
