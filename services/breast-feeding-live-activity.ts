import { Platform } from 'react-native';
import type { LiveActivity } from 'expo-widgets';
import BreastfeedingActivity, {
  type BreastfeedingActivityProps,
} from '@/widgets/BreastfeedingActivity';

export const BREASTFEEDING_LIVE_ACTIVITY_URL = 'milestones:///?open=meal';

let activeInstance: LiveActivity<BreastfeedingActivityProps> | null = null;

export function startBreastfeedingLiveActivity(props: BreastfeedingActivityProps): boolean {
  if (Platform.OS !== 'ios') return false;

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
  if (Platform.OS !== 'ios') return;

  const instance = activeInstance ?? BreastfeedingActivity.getInstances()[0] ?? null;
  if (instance) {
    void instance.end('immediate');
  }
  activeInstance = null;
}

export function reconcileBreastfeedingLiveActivity(props: BreastfeedingActivityProps): void {
  if (Platform.OS !== 'ios') return;

  const instances = BreastfeedingActivity.getInstances();
  if (instances.length === 0) {
    startBreastfeedingLiveActivity(props);
    return;
  }

  activeInstance = instances[0] ?? null;
}
