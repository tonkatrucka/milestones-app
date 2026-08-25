/**
 * Australian National Immunisation Program — childhood schedule (birth to 4 years).
 * Source: Australian Government Department of Health, Disability and Ageing,
 * National Immunisation Program schedule (June 2026).
 * https://www.health.gov.au/sites/default/files/2026-06/national-immunisation-program-schedule.pdf
 *
 * Routine funded doses for all children. Extra doses apply for Aboriginal and
 * Torres Strait Islander children and for specified medical risk conditions —
 * always confirm with a GP or immunisation provider.
 */

import { addMonths } from 'date-fns';
import { parseCalendarDate } from '@/lib/calendar-date';

export const NIP_SCHEDULE_URL =
  'https://www.health.gov.au/sites/default/files/2026-06/national-immunisation-program-schedule.pdf';

export interface ScheduledVaccine {
  code: string;
  name: string;
  atMonths: number;
  doseNumber: number;
  notes?: string;
}

/** NIP childhood points for all children. Ages are calendar months from birth. */
export const NIP_CHILDHOOD_SCHEDULE: ScheduledVaccine[] = [
  {
    code: 'HepB',
    name: 'Hepatitis B',
    atMonths: 0,
    doseNumber: 1,
    notes: 'Usually given in hospital at birth',
  },
  {
    code: 'DTPa-hepB-IPV-Hib',
    name: 'DTPa-hepB-IPV-Hib (Infanrix hexa or Vaxelis)',
    atMonths: 2,
    doseNumber: 1,
    notes: 'Can be given from 6 weeks',
  },
  {
    code: 'Rotavirus',
    name: 'Rotavirus (Rotarix)',
    atMonths: 2,
    doseNumber: 1,
    notes: 'First dose by 14 weeks of age',
  },
  {
    code: 'PCV13',
    name: 'Pneumococcal (Prevenar 13)',
    atMonths: 2,
    doseNumber: 1,
  },
  {
    code: 'DTPa-hepB-IPV-Hib',
    name: 'DTPa-hepB-IPV-Hib (Infanrix hexa or Vaxelis)',
    atMonths: 4,
    doseNumber: 2,
  },
  {
    code: 'Rotavirus',
    name: 'Rotavirus (Rotarix)',
    atMonths: 4,
    doseNumber: 2,
    notes: 'Second dose by 24 weeks of age',
  },
  {
    code: 'PCV13',
    name: 'Pneumococcal (Prevenar 13)',
    atMonths: 4,
    doseNumber: 2,
  },
  {
    code: 'DTPa-hepB-IPV-Hib',
    name: 'DTPa-hepB-IPV-Hib (Infanrix hexa or Vaxelis)',
    atMonths: 6,
    doseNumber: 3,
  },
  {
    code: 'Influenza',
    name: 'Influenza (annual)',
    atMonths: 6,
    doseNumber: 1,
    notes: 'Annual from 6 months to under 5 years',
  },
  {
    code: 'MenACWY',
    name: 'Meningococcal ACWY (Nimenrix)',
    atMonths: 12,
    doseNumber: 1,
  },
  {
    code: 'MMR',
    name: 'MMR (measles, mumps, rubella)',
    atMonths: 12,
    doseNumber: 1,
  },
  {
    code: 'PCV13',
    name: 'Pneumococcal (Prevenar 13)',
    atMonths: 12,
    doseNumber: 3,
  },
  {
    code: 'Hib',
    name: 'Hib (ActHIB)',
    atMonths: 18,
    doseNumber: 1,
  },
  {
    code: 'MMRV',
    name: 'MMRV (measles, mumps, rubella, varicella)',
    atMonths: 18,
    doseNumber: 1,
  },
  {
    code: 'DTPa',
    name: 'DTPa (Infanrix or Tripacel)',
    atMonths: 18,
    doseNumber: 1,
  },
  {
    code: 'DTPa-IPV',
    name: 'DTPa-IPV (Infanrix IPV or Quadracel)',
    atMonths: 48,
    doseNumber: 1,
  },
];

/**
 * Returns the NIP childhood schedule with each dose's due date from the child's
 * date of birth.
 */
export function getScheduleWithDates(
  dateOfBirth: string,
): Array<ScheduledVaccine & { dueDate: Date }> {
  const dob = parseCalendarDate(dateOfBirth);
  return NIP_CHILDHOOD_SCHEDULE.map((v) => ({
    ...v,
    dueDate: addMonths(dob, v.atMonths),
  }));
}
