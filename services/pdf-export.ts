/**
 * Pediatrician-ready PDF export.
 * Uses expo-print (HTML → PDF) + expo-sharing, imported only when sharing.
 */

import type { Child } from '@/lib/database.types';
import {
  buildVisitSummaryHtml,
  type VisitSummaryInput,
} from '@/lib/visit-summary';
import { getRecentEvents } from '@/services/events';
import { getFirstWords } from '@/services/first-words';
import { getGrowthEntries } from '@/services/growth';
import { getMilestones } from '@/services/milestones';
import { getSolidFoods } from '@/services/solid-foods';
import { getVaccinations } from '@/services/vaccinations';

export async function loadVisitSummaryInput(
  child: Pick<Child, 'id' | 'name' | 'date_of_birth'>,
): Promise<VisitSummaryInput> {
  const [events, growthEntries, milestones, vaccinations, solidFoods, firstWords] =
    await Promise.all([
      getRecentEvents(child.id, 30),
      getGrowthEntries(child.id),
      getMilestones(child.id),
      getVaccinations(child.id),
      getSolidFoods(child.id),
      getFirstWords(child.id),
    ]);
  return {
    childName: child.name,
    childDob: child.date_of_birth,
    events,
    growthEntries,
    milestones,
    vaccinations,
    solidFoods,
    firstWords,
  };
}

/**
 * Generate and share a pediatrician-ready PDF for the given visit summary.
 */
export async function exportAndSharePdf(input: VisitSummaryInput): Promise<void> {
  const [{ printToFileAsync }, Sharing] = await Promise.all([
    import('expo-print'),
    import('expo-sharing'),
  ]);
  const html = buildVisitSummaryHtml(input);
  const { uri } = await printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${input.childName} — Doctor visit summary`,
      UTI: 'com.adobe.pdf',
    });
  }
}
