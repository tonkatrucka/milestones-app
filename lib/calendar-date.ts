import { format, parseISO } from 'date-fns';

/**
 * Parse a calendar date (milestones, memories, DOB) as local midnight.
 * Accepts plain "YYYY-MM-DD" strings and ISO timestamps — always uses the
 * date portion as a local calendar day, ignoring any time/timezone suffix.
 */
export function parseCalendarDate(value: string): Date {
  const datePart = value.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [y, m, d] = datePart.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return parseISO(value);
}

/** Local calendar date key ("YYYY-MM-DD") for a stored date value. */
export function calendarDateKey(value: string): string {
  return format(parseCalendarDate(value), 'yyyy-MM-dd');
}

/** Display a stored DOB as DD/MM/YYYY for text inputs. */
export function formatDobForInput(value: string): string {
  const d = parseCalendarDate(value);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

export function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Parse DD/MM/YYYY to YYYY-MM-DD, or null if invalid / future. */
export function parseDateInput(value: string): string | null {
  const parts = value.split('/');
  if (parts.length !== 3 || parts[2].length !== 4) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  if (date > new Date()) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
