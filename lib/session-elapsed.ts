import { differenceInMinutes } from 'date-fns';

export function formatSessionElapsed(startedAt: string): string {
  const mins = Math.max(0, differenceInMinutes(new Date(), new Date(startedAt)));
  if (mins < 1) return 'just now';
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins}m`;
}

export function getSessionElapsedMins(startedAt: string): number {
  return Math.max(1, differenceInMinutes(new Date(), new Date(startedAt)));
}
