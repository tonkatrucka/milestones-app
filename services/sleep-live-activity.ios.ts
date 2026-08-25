import type { LiveActivity } from 'expo-widgets';
import SleepingActivity from '@/widgets/SleepingActivity';

export type SleepingActivityProps = {
  startedAtMs: number;
};

export const SLEEP_LIVE_ACTIVITY_URL = 'milestones:///?open=sleep';

let activeInstance: LiveActivity<SleepingActivityProps> | null = null;

export function startSleepingLiveActivity(props: SleepingActivityProps): boolean {
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
  const instance = activeInstance ?? SleepingActivity.getInstances()[0] ?? null;
  if (instance) {
    void instance.end('immediate');
  }
  activeInstance = null;
}

export function reconcileSleepingLiveActivity(props: SleepingActivityProps): void {
  const instances = SleepingActivity.getInstances();
  if (instances.length === 0) {
    startSleepingLiveActivity(props);
    return;
  }

  activeInstance = instances[0] ?? null;
}
