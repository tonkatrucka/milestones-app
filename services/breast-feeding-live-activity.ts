/** Android / web stub — iOS implementation is in `.ios.ts`. */

export type BreastfeedingActivityProps = {
  startedAtMs: number;
  sideLabel: string;
};

export const BREASTFEEDING_LIVE_ACTIVITY_URL = 'milestones:///?open=meal';

export function startBreastfeedingLiveActivity(_props: BreastfeedingActivityProps): boolean {
  return false;
}

export function endBreastfeedingLiveActivity(): void {}

export function reconcileBreastfeedingLiveActivity(_props: BreastfeedingActivityProps): void {}
