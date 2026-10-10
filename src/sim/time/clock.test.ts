import { describe, expect, it } from 'vitest';
import { advanceDate, createDateState } from './clock';

describe('clock (port of TimerManager<TimerGameCalendar>::Elapsed)', () => {
  it('starts on 1 January of the starting year', () => {
    expect(createDateState(1950)).toEqual({ date: 712223, dateFract: 0, year: 1950, month: 0 });
  });

  it('advances one day every 74 ticks', () => {
    const d = createDateState(1950);
    for (let i = 0; i < 73; i++) expect(advanceDate(d).newDay).toBe(false);
    expect(advanceDate(d)).toEqual({ newDay: true, newMonth: false, newYear: false });
    expect([d.date, d.dateFract]).toEqual([712224, 0]);
  });

  it('reports new months and years', () => {
    const d = createDateState(1950);
    let months = 0;
    let years = 0;
    for (let i = 0; i < 365 * 74; i++) {
      const r = advanceDate(d);
      if (r.newMonth) months++;
      if (r.newYear) years++;
    }
    expect([months, years, d.year, d.month]).toEqual([12, 1, 1951, 0]);
  });
});
