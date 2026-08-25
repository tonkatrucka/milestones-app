/**
 * "On This Day" service — checks if any milestone or memory matches today's
 * calendar date (month + day) from a prior year, and schedules a local
 * notification if so. Called once per day from the app root.
 *
 * Pure local: no server call, no LLM, no cost.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { format } from 'date-fns';
import type { Milestone, Memory } from '@/lib/database.types';

const OTD_NOTIFICATION_ID = 'on-this-day';

export interface OnThisDayMatch {
  type: 'milestone' | 'memory';
  title: string;
  id: string;
  yearsAgo: number;
  mediaUrl?: string;
}

/**
 * Find milestones/memories whose month-day matches today from prior years.
 */
export function findOnThisDayMatches(
  milestones: Milestone[],
  memories: Memory[],
): OnThisDayMatch[] {
  const today = new Date();
  const todayMD = format(today, 'MM-dd');
  const thisYear = today.getFullYear();

  const matches: OnThisDayMatch[] = [];

  for (const m of milestones) {
    const achieved = new Date(m.achieved_at);
    if (
      format(achieved, 'MM-dd') === todayMD &&
      achieved.getFullYear() < thisYear
    ) {
      matches.push({
        type: 'milestone',
        title: m.title,
        id: m.id,
        yearsAgo: thisYear - achieved.getFullYear(),
        mediaUrl: m.media_urls[0],
      });
    }
  }

  for (const mem of memories) {
    const occurred = new Date(mem.occurred_at);
    if (
      format(occurred, 'MM-dd') === todayMD &&
      occurred.getFullYear() < thisYear
    ) {
      matches.push({
        type: 'memory',
        title: mem.title,
        id: mem.id,
        yearsAgo: thisYear - occurred.getFullYear(),
        mediaUrl: mem.media_urls[0],
      });
    }
  }

  // Most recent first (largest years gap last, smallest first)
  return matches.sort((a, b) => a.yearsAgo - b.yearsAgo);
}

function buildOTDMessage(matches: OnThisDayMatch[], childName: string): string {
  if (matches.length === 0) return '';
  const first = matches[0];
  const yearLabel = first.yearsAgo === 1 ? 'One year ago today' : `${first.yearsAgo} years ago today`;
  if (matches.length === 1) {
    return `${yearLabel}, ${childName} ${first.type === 'milestone' ? 'achieved' : 'had'}: "${first.title}" ✨`;
  }
  return `${yearLabel} and ${matches.length - 1} more memory — tap to relive them with ${childName}.`;
}

/**
 * Schedule (or replace) today's On This Day notification.
 * Safe to call every time the app becomes active — it replaces any existing
 * OTD notification for the day.
 */
export async function scheduleOnThisDayNotification(
  matches: OnThisDayMatch[],
  childName: string,
): Promise<void> {
  if (Platform.OS === 'web') return;
  if (matches.length === 0) {
    await cancelOnThisDayNotification();
    return;
  }

  // Cancel any existing OTD notification before rescheduling
  await cancelOnThisDayNotification();

  const body = buildOTDMessage(matches, childName);
  const notifyAt = new Date();
  notifyAt.setHours(9, 0, 0, 0); // 9am local time

  // If it's already past 9am today, don't schedule (will try again tomorrow)
  if (notifyAt <= new Date()) return;

  await Notifications.scheduleNotificationAsync({
    identifier: OTD_NOTIFICATION_ID,
    content: {
      title: `On this day — ${childName}`,
      body,
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: notifyAt,
      channelId: Platform.OS === 'android' ? 'milestones-local' : undefined,
    },
  });
}

export async function cancelOnThisDayNotification(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(OTD_NOTIFICATION_ID);
  } catch {
    // Ignore — may not exist
  }
}

/**
 * Schedule monthly birthday prompts for a child from birth to 24 months,
 * then annually. Safe to call repeatedly — replaces existing scheduled ones.
 */
export async function scheduleMonthlyBirthdayPrompts(
  childDob: string,
  childName: string,
): Promise<void> {
  if (Platform.OS === 'web') return;

  const dob = new Date(childDob);
  const now = new Date();

  // Cancel all existing birthday prompts before re-scheduling
  for (let i = 1; i <= 36; i++) {
    try {
      await Notifications.cancelScheduledNotificationAsync(`birthday-month-${i}`);
    } catch { /* ignore */ }
  }

  // Schedule monthly notifications for months 1–24, then annual (years 2–5)
  const prompts: { id: string; date: Date; label: string }[] = [];

  for (let months = 1; months <= 24; months++) {
    const promptDate = new Date(dob);
    promptDate.setMonth(dob.getMonth() + months);
    promptDate.setHours(9, 0, 0, 0);
    if (promptDate > now) {
      prompts.push({
        id: `birthday-month-${months}`,
        date: promptDate,
        label: `${childName} is ${months} month${months === 1 ? '' : 's'} old today! 🎉`,
      });
    }
  }

  // Annual for years 2–5
  for (let years = 2; years <= 5; years++) {
    const promptDate = new Date(dob);
    promptDate.setFullYear(dob.getFullYear() + years);
    promptDate.setHours(9, 0, 0, 0);
    if (promptDate > now) {
      prompts.push({
        id: `birthday-year-${years}`,
        date: promptDate,
        label: `Happy ${years}${years === 2 ? 'nd' : years === 3 ? 'rd' : 'th'} birthday, ${childName}! 🎂`,
      });
    }
  }

  // Schedule up to 20 future prompts (expo-notifications limit per app varies)
  const toSchedule = prompts.slice(0, 20);
  for (const prompt of toSchedule) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: prompt.id,
        content: {
          title: prompt.label,
          body: 'Capture the moment on their Journey tab.',
          sound: false,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: prompt.date,
          channelId: Platform.OS === 'android' ? 'milestones-local' : undefined,
        },
      });
    } catch {
      // Some platforms limit scheduled notifications — fail silently
    }
  }
}
