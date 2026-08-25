import type { LiveActivity } from 'expo-widgets';
import BreastfeedingActivity from '@/widgets/BreastfeedingActivity';

export type BreastfeedingActivityProps = {
  startedAtMs: number;
  sideLabel: string;
};

export const BREASTFEEDING_LIVE_ACTIVITY_URL = 'milestones:///?open=meal';

let activeInstance: LiveActivity<BreastfeedingActivityProps> | null = null;

export function startBreastfeedingLiveActivity(props: BreastfeedingActivityProps): boolean {
  try {
    endBreastfeedingLiveActivity();
    activeInstance = BreastfeedingActivity.start(props, BREASTFEEDING_LIVE_ACTIVITY_URL);
    return true;
  } catch {
    activeInstance = null;
    return false;
  }
}

export function endBreastfeedingLiveActivity(): void {
  const instance = activeInstance ?? BreastfeedingActivity.getInstances()[0] ?? null;
  if (instance) {
    void instance.end('immediate');
  }
  activeInstance = null;
}

export function reconcileBreastfeedingLiveActivity(props: BreastfeedingActivityProps): void {
  const instances = BreastfeedingActivity.getInstances();
  if (instances.length === 0) {
    startBreastfeedingLiveActivity(props);
    return;
  }

  activeInstance = instances[0] ?? null;
}
