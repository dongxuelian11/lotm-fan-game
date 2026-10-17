import type { PublicGameDate } from "../shared/contracts.js";

const DATE_KEYS = ["day", "epoch", "month", "year"] as const;
const MAX_YEAR = 999_999;

function isPlainDate(value: unknown): value is PublicGameDate {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const year = record.year;
  const month = record.month;
  const day = record.day;
  const keys = Object.keys(record).sort();
  const expected = [...DATE_KEYS].sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]) &&
    record.epoch === "FIFTH_EPOCH" &&
    Number.isSafeInteger(year) && (year as number) >= 1 && (year as number) <= MAX_YEAR &&
    Number.isSafeInteger(month) && (month as number) >= 1 && (month as number) <= 12 &&
    Number.isSafeInteger(day) && (day as number) >= 1 &&
    (day as number) <= daysInMonth(year as number, month as number);
}

function assertDate(value: unknown): asserts value is PublicGameDate {
  if (!isPlainDate(value)) {
    throw new TypeError("game date is invalid");
  }
}

function assertWeeks(weeks: unknown): asserts weeks is number {
  if (!Number.isSafeInteger(weeks) || (weeks as number) < 0) {
    throw new RangeError("weeks must be a non-negative safe integer");
  }
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isValidGameDate(value: unknown): value is PublicGameDate {
  return isPlainDate(value);
}

export function addGameWeeks(date: PublicGameDate, weeks: number): PublicGameDate {
  assertDate(date);
  assertWeeks(weeks);

  let year = date.year;
  let month = date.month;
  let day = date.day;
  if (weeks > Math.floor(Number.MAX_SAFE_INTEGER / 7)) {
    throw new RangeError("weeks exceeds supported range");
  }
  let remainingDays = (weeks as number) * 7;
  while (remainingDays > 0) {
    const monthEnd = daysInMonth(year, month);
    const daysUntilMonthEnd = monthEnd - day;
    if (remainingDays <= daysUntilMonthEnd) {
      day += remainingDays;
      remainingDays = 0;
      continue;
    }

    remainingDays -= daysUntilMonthEnd + 1;
    day = 1;
    if (month === 12) {
      year += 1;
      month = 1;
      if (year > MAX_YEAR) {
        throw new RangeError("game date exceeds supported range");
      }
    } else {
      month += 1;
    }
  }

  return { epoch: "FIFTH_EPOCH", year, month, day };
}

export function compareGameDates(left: PublicGameDate, right: PublicGameDate): number {
  assertDate(left);
  assertDate(right);
  if (left.year !== right.year) return left.year - right.year;
  if (left.month !== right.month) return left.month - right.month;
  return left.day - right.day;
}

export function formatGameDate(date: PublicGameDate): string {
  assertDate(date);
  return `第五纪 ${date.year}年${date.month}月${date.day}日`;
}

/** Proleptic Gregorian day count; no weekly simulation or host Date/timezone. */
function ordinal(date: PublicGameDate): number {
  const previousYear = date.year - 1;
  let days = previousYear * 365 + Math.floor(previousYear / 4) - Math.floor(previousYear / 100) + Math.floor(previousYear / 400);
  for (let month = 1; month < date.month; month += 1) days += daysInMonth(date.year, month);
  return days + date.day - 1;
}
export function gameDaysBetween(from: PublicGameDate, to: PublicGameDate): number {
  assertDate(from); assertDate(to);
  return ordinal(to) - ordinal(from);
}
export function addGameDays(date: PublicGameDate, days: number): PublicGameDate {
  assertDate(date);
  if (!Number.isSafeInteger(days) || days < 0) throw new RangeError('days must be a non-negative safe integer');
  const target = ordinal(date) + days;
  const last = ordinal({ epoch: 'FIFTH_EPOCH', year: MAX_YEAR, month: 12, day: 31 });
  if (!Number.isSafeInteger(target) || target > last) throw new RangeError('game date exceeds supported range');
  let low = date.year, high = MAX_YEAR;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (ordinal({ epoch: 'FIFTH_EPOCH', year: middle, month: 1, day: 1 }) <= target) low = middle;
    else high = middle - 1;
  }
  let remaining = target - ordinal({ epoch: 'FIFTH_EPOCH', year: low, month: 1, day: 1 });
  let month = 1;
  while (remaining >= daysInMonth(low, month)) { remaining -= daysInMonth(low, month); month += 1; }
  return { epoch: 'FIFTH_EPOCH', year: low, month, day: remaining + 1 };
}
export function addGameYears(date: PublicGameDate, years: number): PublicGameDate {
  assertDate(date);
  if (!Number.isSafeInteger(years) || years < 0 || date.year + years > MAX_YEAR) throw new RangeError('years exceeds supported range');
  return { ...date, year: date.year + years, day: Math.min(date.day, daysInMonth(date.year + years, date.month)) };
}
export function completedGameYears(from: PublicGameDate, to: PublicGameDate): number {
  assertDate(from); assertDate(to);
  if (compareGameDates(from, to) > 0) throw new RangeError('anniversary precedes its origin');
  const years = to.year - from.year;
  return years - (compareGameDates(addGameYears(from, years), to) > 0 ? 1 : 0);
}
