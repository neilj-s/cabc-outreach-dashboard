/**
 * Parse a bare YYYY-MM-DD date string in LOCAL time.
 *
 * `new Date('2026-07-15')` parses as UTC midnight, which shifts to the
 * previous day in any timezone west of UTC (e.g. Toronto, EDT/EST).
 * Splitting the parts and using the multi-arg Date constructor keeps the
 * date on the intended calendar day regardless of the viewer's timezone.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}
