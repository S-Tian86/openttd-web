import { describe, expect, it } from 'vitest';
import type { GenerationProgress } from '../sim/world/generate';
import { runGenerationSlice } from './generation';

function* steps(): Generator<GenerationProgress, string, void> {
  yield { fraction: 0.25 };
  yield { fraction: 0.5 };
  yield { fraction: 0.75 };
  return 'world';
}

const tickingClock = (): (() => number) => {
  let now = 0;
  return () => (now += 10);
};

describe('generation slices', () => {
  it('runs steps until the deadline and reports progress', () => {
    const gen = steps();
    expect(runGenerationSlice(gen, 15, tickingClock())).toEqual({ done: false, fraction: 0.5 });
  });

  it('always makes progress and returns the world at the end', () => {
    const gen = steps();
    expect(runGenerationSlice(gen, 0, tickingClock())).toEqual({ done: false, fraction: 0.25 });
    expect(runGenerationSlice(gen, Infinity, tickingClock())).toEqual({
      done: true,
      value: 'world',
    });
  });
});
