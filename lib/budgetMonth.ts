function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// Returns the { year, month (0-indexed), day } of the current budget period start,
// clamping day to the last real day of the target month.
function periodStartParts(monthStartDay: number): { year: number; month: number; day: number } {
  const today = new Date();
  let year  = today.getFullYear();
  let month = today.getMonth();

  if (today.getDate() < monthStartDay) {
    month -= 1;
    if (month < 0) { month = 11; year -= 1; }
  }

  const lastDay = new Date(year, month + 1, 0).getDate();
  return { year, month, day: Math.min(monthStartDay, lastDay) };
}

export function getMonthStart(monthStartDay: number): string {
  const { year, month, day } = periodStartParts(monthStartDay);
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function getBudgetMonthBounds(monthStartDay: number): {
  monthStart: string;
  daysElapsed: number;   // today is day N of the budget period (1-based)
  daysInMonth: number;   // total days in this budget period
} {
  const { year, month, day } = periodStartParts(monthStartDay);
  const monthStart  = `${year}-${pad(month + 1)}-${pad(day)}`;
  const startMidnight = new Date(year, month, day);

  // Next budget period start (same day clamping for the next month)
  let nextYear = year, nextMonth = month + 1;
  if (nextMonth > 11) { nextMonth = 0; nextYear += 1; }
  const nextLastDay   = new Date(nextYear, nextMonth + 1, 0).getDate();
  const nextMidnight  = new Date(nextYear, nextMonth, Math.min(monthStartDay, nextLastDay));

  const today         = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Assumes 24-hour days — DST transitions (23 h / 25 h days) can shift the count by ±1.
  const MS = 86_400_000;
  const daysElapsed = Math.floor((todayMidnight.getTime() - startMidnight.getTime()) / MS) + 1;
  const daysInMonth = Math.floor((nextMidnight.getTime()  - startMidnight.getTime()) / MS);

  return { monthStart, daysElapsed, daysInMonth };
}
