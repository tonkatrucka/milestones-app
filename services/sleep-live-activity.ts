import { Platform } from 'react-native';
import type { LiveActivity } from 'expo-widgets';
import SleepingActivity, { type SleepingActivityProps } from '@/widgets/SleepingActivity';

export const SLEEP_LIVE_ACTIVITY_URL = 'milestones:///?open=sleep';

let activeInstance: LiveActivity<SleepingActivityProps> | null = null;

export function startSleepingLiveActivity(props: SleepingActivityProps): boolean {
  if (Platform.OS !== 'ios') return false;

  try {
    endSleepingLiveActivity();
    activeInstance = SleepingActivity.start(props, SLEEP_LIVE_ACTIVITY_URL);
    return true;
  } catch {
    activeInstance = null;
    return false;
  }
}

export function endSleepingLiveActivity(): void {
  if (Platform.OS !== 'ios') return;

  const instance = activeInstance ?? SleepingActivity.getInstances()[0] ?? null;
  if (instance) {
    void instance.end('immediate');
  }
  activeInstance = null;
}

export function reconcileSleepingLiveActivity(props: SleepingActivityProps): void {
  if (Platform.OS !== 'ios') return;

  const instances = SleepingActivity.getInstances();
  if (instances.length === 0) {
    startSleepingLiveActivity(props);
    return;
  }

  activeInstance = instances[0] ?? null;
}
