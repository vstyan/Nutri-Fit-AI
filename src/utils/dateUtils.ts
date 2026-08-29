/**
 * Date utilities with local timezone awareness to prevent UTC rollover bugs.
 */

/**
 * Returns a date formatted as YYYY-MM-DD in the user's LOCAL timezone.
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Safely adds or subtracts days from a YYYY-MM-DD string in local time.
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return getLocalDateString();
  }
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
}

/**
 * Formats a YYYY-MM-DD date string into a user-friendly label (e.g. 'Today', 'Yesterday', or 'Fri, Aug 28').
 */
export function formatDisplayDate(dateStr: string): string {
  const todayStr = getLocalDateString(new Date());
  if (dateStr === todayStr) return 'Today';
  
  const yesterdayStr = addDaysToDateString(todayStr, -1);
  if (dateStr === yesterdayStr) return 'Yesterday';

  const tomorrowStr = addDaysToDateString(todayStr, 1);
  if (dateStr === tomorrowStr) return 'Tomorrow';

  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  return dateStr;
}

/**
 * Generates an array of YYYY-MM-DD date strings for the past N days up to baseDateStr.
 */
export function getPastNDaysDateStrings(count: number, baseDateStr: string = getLocalDateString()): string[] {
  const dates: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    dates.push(addDaysToDateString(baseDateStr, -i));
  }
  return dates;
}
