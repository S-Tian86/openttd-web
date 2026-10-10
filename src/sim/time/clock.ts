import { DAY_TICKS } from '../core/constants';
import { convertDateToYMD, convertYMDToDate } from './date';

/** One clock (calendar or economy). Port of TimerGameCalendar / TimerGameEconomy state. */
export interface DateState {
  date: number;
  dateFract: number;
  year: number;
  month: number;
}

export function createDateState(startYear: number): DateState {
  return { date: convertYMDToDate(startYear, 0, 1), dateFract: 0, year: startYear, month: 0 };
}

/**
 * Advances one tick. Year and month are updated before the caller fires its timers.
 * Port of timer_game_calendar.cpp:TimerManager<TimerGameCalendar>::Elapsed (calendar mode,
 * 12 minutes per year); the economy clock is identical in calendar timekeeping.
 */
export function advanceDate(d: DateState): {
  newDay: boolean;
  newMonth: boolean;
  newYear: boolean;
} {
  d.dateFract++;
  if (d.dateFract < DAY_TICKS) return { newDay: false, newMonth: false, newYear: false };
  d.dateFract = 0;
  d.date++;
  const ymd = convertDateToYMD(d.date);
  const newMonth = ymd.month !== d.month;
  const newYear = ymd.year !== d.year;
  d.month = ymd.month;
  d.year = ymd.year;
  return { newDay: true, newMonth, newYear };
}
