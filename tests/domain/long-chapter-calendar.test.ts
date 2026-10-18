import { describe, expect, it } from 'vitest';
import { addGameDays, addGameYears, completedGameYears, gameDaysBetween } from '../../src/domain/game-calendar.js';
const d = (year: number, month: number, day: number) => ({ epoch: 'FIFTH_EPOCH' as const, year, month, day });
describe('long-chapter exact Gregorian dates without simulated weekly bills', () => {
  it('counts sixty real anniversaries including leap and century rules', () => {
    const start = d(1351, 6, 12), end = d(1411, 6, 12), days = gameDaysBetween(start, end);
    expect(days).toBe(21914); expect(days).not.toBe(60 * 52 * 7); expect(addGameDays(start, days)).toEqual(end);
    expect(gameDaysBetween(d(1399, 3, 1), d(1400, 3, 1))).toBe(365);
    expect(gameDaysBetween(d(1599, 3, 1), d(1600, 3, 1))).toBe(366);
  });
  it('clamps leap-day anniversaries but never uses host timezone or date overflow', () => {
    expect(addGameYears(d(1340, 2, 29), 60)).toEqual(d(1400, 2, 28));
    expect(addGameDays(d(1399, 12, 29), 7)).toEqual(d(1400, 1, 5));
    expect(addGameDays(d(1600, 2, 28), 1)).toEqual(d(1600, 2, 29));
  });
  it('computes actual completed age years and exact remaining day fragments', () => {
    expect(completedGameYears(d(1351, 8, 21), d(1411, 6, 19))).toBe(59);
    expect(completedGameYears(d(1351, 8, 21), d(1411, 8, 21))).toBe(60);
    expect(gameDaysBetween(d(1411, 6, 12), d(1411, 6, 19))).toBe(7);
    expect(gameDaysBetween(d(1411, 6, 19), d(1411, 6, 12))).toBe(-7);
  });
  it('rejects malformed dates, negative durations and supported-range overflow', () => {
    expect(() => addGameDays(d(1400, 2, 29), 1)).toThrow(); expect(() => addGameDays(d(1400, 1, 1), -1)).toThrow();
    expect(() => addGameDays(d(999999, 12, 31), 1)).toThrow(); expect(() => addGameDays(d(1400, 1, 1), Number.MAX_SAFE_INTEGER)).toThrow();
    expect(() => addGameYears(d(999999, 1, 1), 1)).toThrow(); expect(() => completedGameYears(d(1400, 1, 1), d(1399, 1, 1))).toThrow();
  });
});
