/** Android / web stub — iOS implementation is in `.ios.ts`. */

export type SleepingActivityProps = {
  startedAtMs: number;
};

export const SLEEP_LIVE_ACTIVITY_URL = 'milestones:///?open=sleep';

export function startSleepingLiveActivity(_props: SleepingActivityProps): boolean {
  return false;
}

export function endSleepingLiveActivity(): void {}

export function reconcileSleepingLiveActivity(_props: SleepingActivityProps): void {}
