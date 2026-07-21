export const MINISTRY_TIMEZONE = process.env.MINISTRY_TIMEZONE || 'America/Toronto';

/**
 * Real current date as a YYYY-MM-DD string in the ministry timezone (default America/Toronto).
 * Avoids UTC midnight rollover shifting calendar dates on UTC servers.
 */
export function getTodayISO(timeZone: string = MINISTRY_TIMEZONE): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Parse a bare YYYY-MM-DD date string using UTC components to avoid DST/timezone shifts.
 */
export function parseUTCDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Subtract N weeks from a YYYY-MM-DD date string using UTC component arithmetic.
 * Returns a YYYY-MM-DD string.
 */
export function subtractWeeks(dateStr: string, weeks: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day - weeks * 7));
  return d.toISOString().split('T')[0];
}
