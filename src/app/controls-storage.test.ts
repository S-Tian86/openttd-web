import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP_CONTROLS } from '../render/controls';
import { CONTROLS_STORAGE_KEY, loadControls, saveControls } from './controls-storage';

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
    expect(loadControls(memory(null))).toEqual(DEFAULT_MAP_CONTROLS);
    expect(loadControls(undefined)).toEqual(DEFAULT_MAP_CONTROLS);
  });

  it('reads back what was saved', () => {
    const storage = memory(null);
    const controls = { scrollMode: 'mapLmb', wheel: 'scroll', wheelSpeed: 12 } as const;
    saveControls(storage, controls);
    expect(loadControls(storage)).toEqual(controls);
  });

  it('keeps each valid field and replaces the invalid ones by their default (untrusted input)', () => {
    const saved = JSON.stringify({ scrollMode: 'mapRmbLocked', wheel: 'sideways', wheelSpeed: 99 });
    expect(loadControls(memory(saved))).toEqual({
      ...DEFAULT_MAP_CONTROLS,
      scrollMode: 'mapRmbLocked',
    });
    expect(loadControls(memory('not json'))).toEqual(DEFAULT_MAP_CONTROLS);
    expect(loadControls(memory('null'))).toEqual(DEFAULT_MAP_CONTROLS);
    expect(loadControls(memory(JSON.stringify({ wheelSpeed: 2.5 })))).toEqual(DEFAULT_MAP_CONTROLS);
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
    expect(loadControls(throwing)).toEqual(DEFAULT_MAP_CONTROLS);
    expect(() => saveControls(throwing, DEFAULT_MAP_CONTROLS)).not.toThrow();
  });
});
