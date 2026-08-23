/**
 * Region-aware childhood vaccination schedules.
 * Sources: NHS (UK), CDC (US), NHMRC (AU), NACI (CA).
 * Weeks are approximate; always defer to the parent's healthcare provider.
 */

export type VaccineRegion = 'UK' | 'US' | 'AU' | 'CA';

export interface ScheduledVaccine {
  code: string;
  name: string;
  atWeeks: number;
  doseNumber: number;
  notes?: string;
}

const UK_SCHEDULE: ScheduledVaccine[] = [
  { code: '6-in-1', name: '6-in-1 (DTaP/IPV/Hib/HepB)', atWeeks: 8, doseNumber: 1 },
  { code: 'MenB', name: 'MenB', atWeeks: 8, doseNumber: 1 },
  { code: 'Rotavirus', name: 'Rotavirus', atWeeks: 8, doseNumber: 1 },
  { code: '6-in-1', name: '6-in-1 (DTaP/IPV/Hib/HepB)', atWeeks: 12, doseNumber: 2 },
  { code: 'PCV', name: 'Pneumococcal (PCV)', atWeeks: 12, doseNumber: 1 },
  { code: 'Rotavirus', name: 'Rotavirus', atWeeks: 12, doseNumber: 2 },
  { code: '6-in-1', name: '6-in-1 (DTaP/IPV/Hib/HepB)', atWeeks: 16, doseNumber: 3 },
  { code: 'MenB', name: 'MenB', atWeeks: 16, doseNumber: 2 },
  { code: 'MMR', name: 'MMR (measles, mumps, rubella)', atWeeks: 52, doseNumber: 1 },
  { code: 'MenACWY', name: 'MenACWY', atWeeks: 52, doseNumber: 1 },
  { code: 'PCV', name: 'Pneumococcal (PCV)', atWeeks: 52, doseNumber: 2 },
  { code: 'Hib-MenC', name: 'Hib/MenC booster', atWeeks: 52, doseNumber: 1 },
  { code: 'MMR', name: 'MMR booster', atWeeks: 156, doseNumber: 2, notes: '3 years 4 months' },
  { code: 'DTaP-IPV', name: 'DTaP/IPV pre-school booster', atWeeks: 156, doseNumber: 1 },
];

const US_SCHEDULE: ScheduledVaccine[] = [
  { code: 'HepB', name: 'Hepatitis B', atWeeks: 0, doseNumber: 1 },
  { code: 'HepB', name: 'Hepatitis B', atWeeks: 4, doseNumber: 2 },
  { code: 'DTaP', name: 'DTaP', atWeeks: 8, doseNumber: 1 },
  { code: 'Hib', name: 'Hib', atWeeks: 8, doseNumber: 1 },
  { code: 'IPV', name: 'Polio (IPV)', atWeeks: 8, doseNumber: 1 },
  { code: 'PCV15', name: 'Pneumococcal (PCV15/PCV20)', atWeeks: 8, doseNumber: 1 },
  { code: 'Rotavirus', name: 'Rotavirus', atWeeks: 8, doseNumber: 1 },
  { code: 'DTaP', name: 'DTaP', atWeeks: 16, doseNumber: 2 },
  { code: 'Hib', name: 'Hib', atWeeks: 16, doseNumber: 2 },
  { code: 'IPV', name: 'Polio (IPV)', atWeeks: 16, doseNumber: 2 },
  { code: 'PCV15', name: 'Pneumococcal (PCV15/PCV20)', atWeeks: 16, doseNumber: 2 },
  { code: 'Rotavirus', name: 'Rotavirus', atWeeks: 16, doseNumber: 2 },
  { code: 'DTaP', name: 'DTaP', atWeeks: 24, doseNumber: 3 },
  { code: 'HepB', name: 'Hepatitis B', atWeeks: 24, doseNumber: 3 },
  { code: 'Hib', name: 'Hib', atWeeks: 24, doseNumber: 3 },
  { code: 'IPV', name: 'Polio (IPV)', atWeeks: 24, doseNumber: 3 },
  { code: 'PCV15', name: 'Pneumococcal (PCV15/PCV20)', atWeeks: 24, doseNumber: 3 },
  { code: 'Influenza', name: 'Influenza (annual)', atWeeks: 26, doseNumber: 1, notes: 'Annual from 6 months' },
  { code: 'DTaP', name: 'DTaP', atWeeks: 65, doseNumber: 4 },
  { code: 'Hib', name: 'Hib', atWeeks: 65, doseNumber: 4 },
  { code: 'MMR', name: 'MMR', atWeeks: 52, doseNumber: 1 },
  { code: 'Varicella', name: 'Varicella', atWeeks: 52, doseNumber: 1 },
  { code: 'HepA', name: 'Hepatitis A', atWeeks: 56, doseNumber: 1 },
];

const AU_SCHEDULE: ScheduledVaccine[] = [
  { code: 'HepB', name: 'Hepatitis B', atWeeks: 0, doseNumber: 1 },
  { code: '6-in-1', name: '6-in-1 (DTaP/IPV/Hib/HepB)', atWeeks: 8, doseNumber: 1 },
  { code: 'PCV13', name: 'Pneumococcal (PCV13)', atWeeks: 8, doseNumber: 1 },
  { code: 'Rotavirus', name: 'Rotavirus', atWeeks: 8, doseNumber: 1 },
  { code: 'MenACWY', name: 'MenACWY', atWeeks: 8, doseNumber: 1 },
  { code: '6-in-1', name: '6-in-1 (DTaP/IPV/Hib/HepB)', atWeeks: 16, doseNumber: 2 },
  { code: 'PCV13', name: 'Pneumococcal (PCV13)', atWeeks: 16, doseNumber: 2 },
  { code: 'Rotavirus', name: 'Rotavirus', atWeeks: 16, doseNumber: 2 },
  { code: '6-in-1', name: '6-in-1 (DTaP/IPV/Hib/HepB)', atWeeks: 24, doseNumber: 3 },
  { code: 'MMR', name: 'MMR', atWeeks: 52, doseNumber: 1 },
  { code: 'MenACWY', name: 'MenACWY', atWeeks: 52, doseNumber: 2 },
  { code: 'Varicella', name: 'Varicella', atWeeks: 65, doseNumber: 1 },
  { code: 'MMR', name: 'MMR', atWeeks: 65, doseNumber: 2 },
  { code: 'PCV13', name: 'Pneumococcal (PCV13)', atWeeks: 65, doseNumber: 3 },
];

const CA_SCHEDULE: ScheduledVaccine[] = [
  { code: 'HepB', name: 'Hepatitis B', atWeeks: 0, doseNumber: 1 },
  { code: 'DTaP', name: 'DTaP-IPV-Hib', atWeeks: 8, doseNumber: 1 },
  { code: 'PCV13', name: 'Pneumococcal (PCV13)', atWeeks: 8, doseNumber: 1 },
  { code: 'Rotavirus', name: 'Rotavirus', atWeeks: 8, doseNumber: 1 },
  { code: 'MenC', name: 'MenC-C', atWeeks: 8, doseNumber: 1 },
  { code: 'DTaP', name: 'DTaP-IPV-Hib', atWeeks: 16, doseNumber: 2 },
  { code: 'PCV13', name: 'Pneumococcal (PCV13)', atWeeks: 16, doseNumber: 2 },
  { code: 'Rotavirus', name: 'Rotavirus', atWeeks: 16, doseNumber: 2 },
  { code: 'DTaP', name: 'DTaP-IPV-Hib', atWeeks: 24, doseNumber: 3 },
  { code: 'HepB', name: 'Hepatitis B', atWeeks: 24, doseNumber: 2 },
  { code: 'Influenza', name: 'Influenza (annual)', atWeeks: 26, doseNumber: 1 },
  { code: 'MMR', name: 'MMR', atWeeks: 52, doseNumber: 1 },
  { code: 'Varicella', name: 'Varicella', atWeeks: 52, doseNumber: 1 },
  { code: 'MenC', name: 'MenC-C booster', atWeeks: 52, doseNumber: 2 },
  { code: 'PCV13', name: 'Pneumococcal (PCV13)', atWeeks: 65, doseNumber: 3 },
];

export const VACCINATION_SCHEDULES: Record<VaccineRegion, ScheduledVaccine[]> = {
  UK: UK_SCHEDULE,
  US: US_SCHEDULE,
  AU: AU_SCHEDULE,
  CA: CA_SCHEDULE,
};

/**
 * Returns the schedule for a given region, with each vaccine's recommended
 * date calculated from the child's date of birth.
 */
export function getScheduleWithDates(
  region: VaccineRegion,
  dateOfBirth: string,
): Array<ScheduledVaccine & { dueDate: Date }> {
  const dob = new Date(dateOfBirth);
  return VACCINATION_SCHEDULES[region].map((v) => ({
    ...v,
    dueDate: new Date(dob.getTime() + v.atWeeks * 7 * 24 * 3600 * 1000),
  }));
}
