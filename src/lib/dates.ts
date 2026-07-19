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

/**
 * Whole days from today until the given YYYY-MM-DD event date.
 * Positive = future, 0 = today, negative = past. Uses the REAL current
 * date. Date.UTC on the y/m/d components gives a clean day delta that is
 * immune to DST shifts.
 */
export function getDaysOut(eventDateStr: string): number {
  const eventDate = parseLocalDate(eventDateStr);
  const today = new Date();
  const d1 = Date.UTC(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
  const d2 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.ceil((d1 - d2) / (1000 * 60 * 60 * 24));
  return isNaN(diffDays) ? 0 : diffDays;
}

/** Real current date as a local YYYY-MM-DD string (for comparing against event.date). */
export function getTodayISO(): string {
  return new Date().toLocaleDateString('en-CA');
}

/** Format a bare YYYY-MM-DD string as a human date, e.g. "July 19, 2026".
 *  Uses parseLocalDate so it never drifts a day across timezones.
 *  Defaults preserve the original long-month / "Date TBD" behavior. */
export function formatDisplayDate(
  dateStr: string,
  opts: { month?: 'long' | 'short'; emptyLabel?: string } = {}
): string {
  const { month = 'long', emptyLabel = 'Date TBD' } = opts;
  if (!dateStr) return emptyLabel;
  try {
    return parseLocalDate(dateStr).toLocaleDateString('en-US', {
      month, day: 'numeric', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/** Local YYYY-MM-DD for (today + daysFromToday). Local-safe; no UTC drift. */
export function getFutureISO(daysFromToday: number): string {
  const d = parseLocalDate(getTodayISO());
  d.setDate(d.getDate() + daysFromToday);
  return d.toLocaleDateString('en-CA');
}
