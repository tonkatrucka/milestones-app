import type { DailyEvent, Memory, Milestone } from '@/lib/database.types';

function joinWithAnd(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

function countPhrase(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Warm, non-AI weekly recap from logged events so the card always has copy. */
export function buildLocalWeeklyNarrative(
  childName: string,
  events: DailyEvent[],
): string | null {
  if (events.length === 0) return null;

  const counts: Partial<Record<DailyEvent['type'], number>> = {};
  for (const event of events) {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
  }

  const parts: string[] = [];
  if (counts.meal) parts.push(countPhrase(counts.meal, 'feed', 'feeds'));
  if (counts.sleep) parts.push(countPhrase(counts.sleep, 'nap', 'naps'));
  if (counts.nappy) parts.push(countPhrase(counts.nappy, 'nappy', 'nappies'));
  if (counts.pump) parts.push(countPhrase(counts.pump, 'pump', 'pumps'));
  if (counts.medication) parts.push(countPhrase(counts.medication, 'medicine dose', 'medicine doses'));
  if (counts.temperature) parts.push(countPhrase(counts.temperature, 'temperature check', 'temperature checks'));

  if (parts.length === 0) {
    return `You logged ${countPhrase(events.length, 'moment', 'moments')} for ${childName} this week.`;
  }

  return `This week ${childName} had ${joinWithAnd(parts)}.`;
}

/** Warm, non-AI monthly recap from journey entries so the Journal card always has copy. */
export function buildLocalMonthlyRecap(
  childName: string,
  monthLabel: string,
  milestones: Pick<Milestone, 'title'>[],
  memories: Pick<Memory, 'title'>[],
): string | null {
  if (milestones.length === 0 && memories.length === 0) return null;

  const bits: string[] = [];
  if (milestones.length > 0) {
    const titles = milestones.slice(0, 3).map((m) => m.title);
    const extra = milestones.length > 3 ? ` and ${milestones.length - 3} more` : '';
    bits.push(
      `${countPhrase(milestones.length, 'milestone', 'milestones')} — ${titles.join(', ')}${extra}`,
    );
  }
  if (memories.length > 0) {
    const titles = memories.slice(0, 3).map((m) => m.title);
    const extra = memories.length > 3 ? ` and ${memories.length - 3} more` : '';
    bits.push(
      `${countPhrase(memories.length, 'memory', 'memories')} — ${titles.join(', ')}${extra}`,
    );
  }

  return `${monthLabel} in ${childName}'s story: ${bits.join('. ')}.`;
}

export function currentMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthKeyLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}
