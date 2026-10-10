export { DAY_TICKS } from '../core/constants';

/** Port of timer_game_common.h: DEF_START_YEAR. */
export const DEF_START_YEAR = 1950;

/** Cumulative days before each month in a leap year. Port of timer_game_common.cpp:_accum_days_for_month. */
const ACCUM_DAYS_FOR_MONTH = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335] as const;
const ACCUM_MAR = 60;

/** Port of TimerGame::IsLeapYear. */
export const isLeapYear = (y: number): boolean => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
const daysInYear = (y: number): number => (isLeapYear(y) ? 366 : 365);

/** Port of TimerGame::DateAtStartOfYear. */
export function dateAtStartOfYear(y: number): number {
  if (y === 0) return 0;
  const p = y - 1;
  return 365 * y + Math.floor(p / 4) - Math.floor(p / 100) + Math.floor(p / 400) + 1;
}

/** Port of timer_game_common.cpp:CalendarConvertDateToYMD. Month 0..11, day 1..31. */
export function convertDateToYMD(date: number): { year: number; month: number; day: number } {
  let year = 400 * Math.floor(date / (365 * 400 + 97));
  let rem = date % (365 * 400 + 97);
  if (rem >= 365 * 100 + 25) {
    year += 100;
    rem -= 365 * 100 + 25;
    year += 100 * Math.floor(rem / (365 * 100 + 24));
    rem %= 365 * 100 + 24;
  }
  if (!isLeapYear(year) && rem >= 365 * 4) {
    year += 4;
    rem -= 365 * 4;
  }
  year += 4 * Math.floor(rem / (365 * 4 + 1));
  rem %= 365 * 4 + 1;
  while (rem >= daysInYear(year)) {
    rem -= daysInYear(year);
    year++;
  }
  if (!isLeapYear(year) && rem >= ACCUM_MAR - 1) rem++;
  let month = 11;
  while (ACCUM_DAYS_FOR_MONTH[month]! > rem) month--;
  return { year, month, day: rem - ACCUM_DAYS_FOR_MONTH[month]! + 1 };
}

/** Port of timer_game_common.cpp:CalendarConvertYMDToDate. */
export function convertYMDToDate(year: number, month: number, day: number): number {
  let days = ACCUM_DAYS_FOR_MONTH[month]! + day - 1;
  if (!isLeapYear(year) && days >= ACCUM_MAR) days--;
  return dateAtStartOfYear(year) + days;
}
