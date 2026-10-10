import { describe, expect, it } from 'vitest';
import { convertDateToYMD, convertYMDToDate, dateAtStartOfYear, isLeapYear } from './date';

// Fidelity: date numbers computed independently (day 0 = 0000-01-01, year 0 leap).
describe('date arithmetic (port of timer_game_common.cpp)', () => {
  it('applies Gregorian leap years', () => {
    expect([1900, 1950, 1952, 2000].map(isLeapYear)).toEqual([false, false, true, true]);
  });

  it.each([
    [1950, 0, 1, 712223],
    [1950, 1, 1, 712254],
    [1950, 2, 1, 712282],
    [1950, 11, 31, 712587],
    [1951, 0, 1, 712588],
    [2000, 1, 29, 730544],
    [2000, 2, 1, 730545],
    [1900, 2, 1, 694020],
  ])('%i-%i-%i is day %i, both ways', (year, month, day, date) => {
    expect(convertYMDToDate(year, month, day)).toBe(date);
    expect(convertDateToYMD(date)).toEqual({ year, month, day });
  });

  it('knows the start of 1920 and 1950', () => {
    expect(dateAtStartOfYear(1920)).toBe(701265);
    expect(dateAtStartOfYear(1950)).toBe(712223);
  });
});
