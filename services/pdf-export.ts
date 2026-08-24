/**
 * Pediatrician-ready PDF export.
 * Uses expo-print (HTML → PDF) + expo-sharing.
 */

import { format, parseISO, differenceInMonths } from 'date-fns';
import type { Child, DailyEvent, GrowthEntry, Milestone, VaccinationRecord } from '@/lib/database.types';
import { getEventDetail, EVENT_LABELS } from '@/lib/event-display';
import { getRecentEvents } from '@/services/events';
import { getGrowthEntries } from '@/services/growth';
import { getMilestones } from '@/services/milestones';
import { getVaccinations } from '@/services/vaccinations';

export interface PdfExportOptions {
  childName: string;
  childDob: string;
  events: DailyEvent[];
  growthEntries: GrowthEntry[];
  milestones: Milestone[];
  vaccinations: VaccinationRecord[];
  exportedAt?: Date;
}

function ageLabel(dob: string): string {
  const months = differenceInMonths(new Date(), parseISO(dob));
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}y ${rem}m` : `${years} years`;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEventsSection(events: DailyEvent[]): string {
  if (events.length === 0) return '<p>No activities logged.</p>';

  // Group by date
  const byDate = new Map<string, DailyEvent[]>();
  for (const ev of events) {
    const dateKey = format(parseISO(ev.occurred_at), 'yyyy-MM-dd');
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(ev);
  }

  const sortedDates = [...byDate.keys()].sort().reverse();
  const rows = sortedDates.map((date) => {
    const dayEvents = byDate.get(date)!;
    const dateLabel = format(parseISO(date), 'd MMM yyyy');
    const eventRows = dayEvents.map((ev) => {
      const time = format(parseISO(ev.occurred_at), 'h:mm a');
      const label = EVENT_LABELS[ev.type as keyof typeof EVENT_LABELS] ?? ev.type;
      const detail = escHtml(getEventDetail(ev));
      const notes = ev.notes ? ` — ${escHtml(ev.notes)}` : '';
      return `<tr><td>${escHtml(time)}</td><td>${escHtml(label)}</td><td>${detail}${notes}</td></tr>`;
    }).join('');
    return `
      <tr class="date-row"><td colspan="3"><strong>${escHtml(dateLabel)}</strong></td></tr>
      ${eventRows}
    `;
  }).join('');

  return `
    <table>
      <thead><tr><th>Time</th><th>Type</th><th>Detail</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildGrowthSection(entries: GrowthEntry[]): string {
  if (entries.length === 0) return '<p>No growth measurements recorded.</p>';

  const rows = entries.map((e) => {
    const date = format(parseISO(e.measured_at), 'd MMM yyyy');
    const weight = e.weight_kg != null ? `${e.weight_kg} kg` : '—';
    const height = e.height_cm != null ? `${e.height_cm} cm` : '—';
    const head = e.head_cm != null ? `${e.head_cm} cm` : '—';
    const notes = e.notes ? escHtml(e.notes) : '';
    return `<tr><td>${escHtml(date)}</td><td>${weight}</td><td>${height}</td><td>${head}</td><td>${notes}</td></tr>`;
  }).join('');

  return `
    <table>
      <thead><tr><th>Date</th><th>Weight</th><th>Height</th><th>Head circ.</th><th>Notes</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildMilestonesSection(milestones: Milestone[]): string {
  if (milestones.length === 0) return '<p>No milestones logged.</p>';

  const rows = milestones.map((m) => {
    const date = format(parseISO(m.achieved_at), 'd MMM yyyy');
    return `<tr><td>${escHtml(date)}</td><td>${escHtml(m.category)}</td><td>${escHtml(m.title)}</td></tr>`;
  }).join('');

  return `
    <table>
      <thead><tr><th>Date</th><th>Category</th><th>Milestone</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildVaccinationsSection(vaccinations: VaccinationRecord[]): string {
  if (vaccinations.length === 0) return '<p>No vaccinations recorded.</p>';

  const rows = vaccinations.map((v) => {
    const date = format(parseISO(v.administered_at), 'd MMM yyyy');
    const clinic = v.clinic ? escHtml(v.clinic) : '—';
    return `<tr><td>${escHtml(date)}</td><td>${escHtml(v.vaccine_name)}</td><td>Dose ${v.dose_number}</td><td>${clinic}</td></tr>`;
  }).join('');

  return `
    <table>
      <thead><tr><th>Date</th><th>Vaccine</th><th>Dose</th><th>Clinic</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildHtml(options: PdfExportOptions): string {
  const { childName, childDob, events, growthEntries, milestones, vaccinations, exportedAt = new Date() } = options;
  const age = ageLabel(childDob);
  const dob = format(parseISO(childDob), 'd MMM yyyy');
  const exportDate = format(exportedAt, 'd MMM yyyy');
  const eventsCoverage = events.length > 0
    ? `${format(parseISO(events[events.length - 1].occurred_at), 'd MMM yyyy')} – ${format(parseISO(events[0].occurred_at), 'd MMM yyyy')}`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${escHtml(childName)} — Health Summary</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 12px; color: #222; padding: 32px; }
    h1 { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
    h2 { font-size: 15px; font-weight: 700; margin: 24px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    .meta { font-size: 11px; color: #666; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #555; border-bottom: 1px solid #ccc; padding: 4px 6px; }
    td { padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
    .date-row td { background: #f5f5f5; font-size: 11px; padding: 3px 6px; }
    p { color: #666; font-style: italic; }
    .footer { margin-top: 32px; font-size: 10px; color: #aaa; text-align: center; }
  </style>
</head>
<body>
  <h1>${escHtml(childName)}</h1>
  <p class="meta">Born ${escHtml(dob)} &nbsp;·&nbsp; ${escHtml(age)} &nbsp;·&nbsp; Exported ${escHtml(exportDate)}</p>

  <h2>Growth</h2>
  ${buildGrowthSection(growthEntries)}

  <h2>Milestones</h2>
  ${buildMilestonesSection(milestones)}

  <h2>Vaccinations</h2>
  ${buildVaccinationsSection(vaccinations)}

  <h2>Activity log${eventsCoverage ? ` (${escHtml(eventsCoverage)})` : ''}</h2>
  ${buildEventsSection(events)}

  <p class="footer">Generated by Milestones &nbsp;·&nbsp; For informational purposes only. Always follow your healthcare provider's advice.</p>
</body>
</html>`;
}

/**
 * Generate and share a pediatrician-ready PDF for the given child.
 */
export async function exportAndSharePdf(options: PdfExportOptions): Promise<void> {
  const [{ printToFileAsync }, Sharing] = await Promise.all([
    import('expo-print'),
    import('expo-sharing'),
  ]);
  const html = buildHtml(options);
  const { uri } = await printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${options.childName} — Health Summary`,
      UTI: 'com.adobe.pdf',
    });
  }
}

/**
 * Collect growth, vaccinations, milestones, and recent activity, then share
 * a doctor-visit PDF. Used from Health & Records — not tied to one tracker.
 */
export async function exportDoctorVisitSummary(
  child: Pick<Child, 'id' | 'name' | 'date_of_birth'>,
): Promise<void> {
  const [events, growthEntries, milestones, vaccinations] = await Promise.all([
    getRecentEvents(child.id, 30),
    getGrowthEntries(child.id),
    getMilestones(child.id),
    getVaccinations(child.id),
  ]);
  await exportAndSharePdf({
    childName: child.name,
    childDob: child.date_of_birth,
    events,
    growthEntries,
    milestones,
    vaccinations,
  });
}
