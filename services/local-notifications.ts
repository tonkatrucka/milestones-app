/**
 * Local notification scheduling helpers.
 * Uses expo-notifications (already installed).
 * These are purely local — no push token required.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ─── Android channel setup ────────────────────────────────────────────────────

export async function ensureLocalChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('milestones-local', {
    name: 'Milestones reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    vibrationPattern: [0, 200],
  });
}

// ─── Medication dose reminder ─────────────────────────────────────────────────

/**
 * Schedule a local notification for the next safe medication dose.
 * Uses a unique identifier so re-scheduling replaces the old one.
 */
export async function scheduleMedicationReminder(params: {
  medicationName: string;
  doseIntervalHours: number;
  lastDoseAt: Date;
}): Promise<void> {
  if (Platform.OS === 'web') return;
  const { medicationName, doseIntervalHours, lastDoseAt } = params;
  const nextDose = new Date(lastDoseAt.getTime() + doseIntervalHours * 3600 * 1000);

  // Cancel any existing reminder for this medication
  await cancelMedicationReminder(medicationName);

  if (nextDose <= new Date()) return; // already past — don't schedule

  await Notifications.scheduleNotificationAsync({
    identifier: medicationReminderId(medicationName),
    content: {
      title: `${medicationName} reminder`,
      body: 'Time for the next dose.',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: nextDose,
      channelId: Platform.OS === 'android' ? 'milestones-local' : undefined,
    },
  });
}

export async function cancelMedicationReminder(medicationName: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(medicationReminderId(medicationName));
  } catch {
    // Ignore — notification may not exist
  }
}

function medicationReminderId(name: string): string {
  return `med-reminder-${name.toLowerCase().replace(/\s+/g, '-')}`;
}

// ─── Wellbeing daily check-in nudge ──────────────────────────────────────────

const WELLBEING_NOTIFICATION_ID = 'wellbeing-daily-checkin';

/**
 * Schedule a daily wellbeing check-in notification at the given hour.
 * Cancels any existing one first.
 */
export async function scheduleWellbeingReminder(hourOfDay: number): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelWellbeingReminder();

  await Notifications.scheduleNotificationAsync({
    identifier: WELLBEING_NOTIFICATION_ID,
    content: {
      title: 'How are you doing?',
      body: 'Take 30 seconds to check in on yourself.',
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: hourOfDay,
      minute: 0,
      channelId: Platform.OS === 'android' ? 'milestones-local' : undefined,
    },
  });
}

export async function cancelWellbeingReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(WELLBEING_NOTIFICATION_ID);
  } catch {
    // Ignore
  }
}

// ─── Nap window alert ─────────────────────────────────────────────────────────

const NAP_ALERT_ID = 'nap-window-alert';

/**
 * Schedule a single local notification N minutes before the predicted nap window.
 * Cancels any existing nap alert first.
 */
export async function scheduleNapAlert(params: {
  predictedNapStart: Date;
  leadTimeMinutes?: number;
}): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelNapAlert();

  const { predictedNapStart, leadTimeMinutes = 20 } = params;
  const alertTime = new Date(predictedNapStart.getTime() - leadTimeMinutes * 60 * 1000);

  if (alertTime <= new Date()) return; // window already passed

  await Notifications.scheduleNotificationAsync({
    identifier: NAP_ALERT_ID,
    content: {
      title: 'Nap window approaching',
      body: `Wind-down time — nap in about ${leadTimeMinutes} minutes.`,
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: alertTime,
      channelId: Platform.OS === 'android' ? 'milestones-local' : undefined,
    },
  });
}

export async function cancelNapAlert(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NAP_ALERT_ID);
  } catch {
    // Ignore
  }
}
