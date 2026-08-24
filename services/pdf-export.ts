/**
 * Pediatrician-ready PDF export.
 * Uses expo-print (HTML → PDF) + expo-sharing, imported only when exporting.
 */

import type {
  Child,
  DailyEvent,
  FirstWord,
  GrowthEntry,
  Milestone,
  SolidFood,
  VaccinationRecord,
} from '@/lib/database.types';
import { buildVisitSummaryHtml } from '@/lib/visit-summary';
import { getRecentEvents } from '@/services/events';
import { getFirstWords } from '@/services/first-words';
import { getGrowthEntries } from '@/services/growth';
import { getMilestones } from '@/services/milestones';
import { getSolidFoods } from '@/services/solid-foods';
import { getVaccinations } from '@/services/vaccinations';

export interface PdfExportOptions {
  childName: string;
  childDob: string;
  events: DailyEvent[];
  growthEntries: GrowthEntry[];
  milestones: Milestone[];
  vaccinations: VaccinationRecord[];
  solidFoods?: SolidFood[];
  firstWords?: FirstWord[];
  exportedAt?: Date;
}

/**
 * Generate and share a pediatrician-ready PDF for the given child.
 */
export async function exportAndSharePdf(options: PdfExportOptions): Promise<void> {
  const [{ printToFileAsync }, Sharing] = await Promise.all([
    import('expo-print'),
    import('expo-sharing'),
  ]);
  const html = buildVisitSummaryHtml({
    childName: options.childName,
    childDob: options.childDob,
    events: options.events,
    growthEntries: options.growthEntries,
    milestones: options.milestones,
    vaccinations: options.vaccinations,
    solidFoods: options.solidFoods ?? [],
    firstWords: options.firstWords ?? [],
    now: options.exportedAt,
  });
  const { uri } = await printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${options.childName} — Doctor visit summary`,
      UTI: 'com.adobe.pdf',
    });
  }
}

/**
 * Collect measurements, immunisations, feeding, development, and recent
 * activity, then share a doctor-visit PDF from Health & Records.
 */
export async function exportDoctorVisitSummary(
  child: Pick<Child, 'id' | 'name' | 'date_of_birth'>,
): Promise<void> {
  const [events, growthEntries, milestones, vaccinations, solidFoods, firstWords] =
    await Promise.all([
      getRecentEvents(child.id, 30),
      getGrowthEntries(child.id),
      getMilestones(child.id),
      getVaccinations(child.id),
      getSolidFoods(child.id),
      getFirstWords(child.id),
    ]);
  await exportAndSharePdf({
    childName: child.name,
    childDob: child.date_of_birth,
    events,
    growthEntries,
    milestones,
    vaccinations,
    solidFoods,
    firstWords,
  });
}
