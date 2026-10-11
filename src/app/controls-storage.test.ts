import { describe, expect, it } from 'vitest';
import {
  CONTROLS_STORAGE_KEY,
  DEFAULT_CONTROLS,
  loadControls,
  saveControls,
} from './controls-storage';

const memory = (value: string | null) => {
  const items = new Map<string, string>();
  if (value !== null) items.set(CONTROLS_STORAGE_KEY, value);
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, v: string) => void items.set(key, v),
  };
};

describe('map control settings in local storage', () => {
  it('starts from OpenTTD defaults when nothing is saved or storage is unavailable', () => {
    expect(DEFAULT_CONTROLS).toEqual({
      scrollMode: 'mapRmb',
      wheel: 'zoom',
      wheelSpeed: 5,
      hoverDelay: 250,
    });
    expect(loadControls(memory(null))).toEqual(DEFAULT_CONTROLS);
    expect(loadControls(undefined)).toEqual(DEFAULT_CONTROLS);
  });

  it('reads back what was saved', () => {
    const storage = memory(null);
    const controls = {
      scrollMode: 'mapLmb',
      wheel: 'scroll',
      wheelSpeed: 12,
      hoverDelay: 0,
    } as const;
    saveControls(storage, controls);
    expect(loadControls(storage)).toEqual(controls);
  });

  it('keeps each valid field and replaces the invalid ones by their default (untrusted input)', () => {
    const saved = JSON.stringify({ scrollMode: 'mapRmbLocked', wheel: 'sideways', wheelSpeed: 99 });
    expect(loadControls(memory(saved))).toEqual({
      ...DEFAULT_CONTROLS,
      scrollMode: 'mapRmbLocked',
    });
    expect(loadControls(memory('not json'))).toEqual(DEFAULT_CONTROLS);
    expect(loadControls(memory('null'))).toEqual(DEFAULT_CONTROLS);
    expect(loadControls(memory(JSON.stringify({ wheelSpeed: 2.5 })))).toEqual(DEFAULT_CONTROLS);
    // gui.hover_delay_ms: 0, or 50 to 6000 in steps of 50.
    expect(loadControls(memory(JSON.stringify({ hoverDelay: 25 })))).toEqual(DEFAULT_CONTROLS);
    expect(loadControls(memory(JSON.stringify({ hoverDelay: 6050 })))).toEqual(DEFAULT_CONTROLS);
    expect(loadControls(memory(JSON.stringify({ hoverDelay: 0 }))).hoverDelay).toBe(0);
    expect(loadControls(memory(JSON.stringify({ hoverDelay: 6000 }))).hoverDelay).toBe(6000);
  });

  it('survives a storage that throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadControls(throwing)).toEqual(DEFAULT_CONTROLS);
    expect(() => saveControls(throwing, DEFAULT_CONTROLS)).not.toThrow();
  });
});
