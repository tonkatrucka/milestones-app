import {
  CDC_CHECKPOINTS,
  type DevCheckpoint,
} from '@/constants/milestone-templates';
import type { DevChecklistStatus } from '@/lib/database.types';

export const CHECK_AGES = [2, 4, 6, 9, 12, 15, 18, 24] as const;
export type CheckAge = (typeof CHECK_AGES)[number];

export const CHECKLIST_AREA_ORDER = [
  'social',
  'language',
  'cognitive',
  'movement',
] as const;

export function formatCheckAgeLabel(months: number): string {
  return `${months} mo`;
}

/** Latest CDC well-child band the child has reached, or 2 months if younger. */
export function currentCheckAge(ageMonths: number): CheckAge {
  const reached = CHECK_AGES.filter((age) => ageMonths >= age);
  return reached[reached.length - 1] ?? CHECK_AGES[0];
}

export function checkpointsForBand(byAgeMonths: number): DevCheckpoint[] {
  return CDC_CHECKPOINTS.filter((checkpoint) => checkpoint.byAgeMonths === byAgeMonths);
}

export function isActEarly(
  checkpoint: DevCheckpoint,
  status: DevChecklistStatus | undefined,
  ageMonths: number,
): boolean {
  if (status === 'yes') return false;
  const threshold = checkpoint.actEarlyIfMissedBy;
  if (threshold == null) return false;
  return ageMonths >= threshold;
}

export function checklistProgress(
  checkpoints: DevCheckpoint[],
  statuses: Record<string, DevChecklistStatus | undefined>,
): { observed: number; total: number } {
  const observed = checkpoints.filter((checkpoint) => statuses[checkpoint.id] === 'yes').length;
  return { observed, total: checkpoints.length };
}
