import { describe, expect, it } from 'vitest';
import { chance16I, createRandomizer, nextRandom, randomRange, scaleToLimit } from './random';

// Fidelity: OpenTTD 15.3 core/random_func.cpp, vectors computed independently.
describe('Randomizer (port of core/random_func.cpp)', () => {
  it.each([
    [0, [4294967295, 3217329428, 536870911, 451640374, 2599350048]],
    [1, [536870911, 3750006036, 1602748415, 981167158, 3129923872]],
    [12345, [536872454, 3515126559, 4023459891, 1208093797, 4215375298]],
  ])('seed %i produces the OpenTTD sequence', (seed, expected) => {
    const r = createRandomizer(seed);
    expect(Array.from({ length: 5 }, () => nextRandom(r))).toEqual(expected);
  });

  it('keeps the state OpenTTD has after five draws', () => {
    const r = createRandomizer(12345);
    for (let i = 0; i < 5; i++) nextRandom(r);
    expect([r.state0, r.state1]).toEqual([247503572, 4215375298]);
  });

  it('scales to a limit exactly, even for 32-bit limits', () => {
    const values = [536872454, 3515126559, 4023459891, 1208093797, 4215375298];
    expect(values.map((v) => scaleToLimit(v, 100))).toEqual([12, 81, 93, 28, 98]);
    expect(values.map((v) => scaleToLimit(v, 0xffffffff))).toEqual([
      536872453, 3515126558, 4023459890, 1208093796, 4215375297,
    ]);
    expect(values.map((v) => scaleToLimit(v, 1000003))).toEqual([
      125000, 818431, 936787, 281282, 981471,
    ]);
  });

  it('draws a range from the generator', () => {
    const r = createRandomizer(12345);
    expect(Array.from({ length: 5 }, () => randomRange(r, 100))).toEqual([12, 81, 93, 28, 98]);
  });

  it('evaluates Chance16I like OpenTTD', () => {
    const values = [536872454, 3515126559, 4023459891, 1208093797, 4215375298];
    expect(values.map((v) => chance16I(1, 3, v))).toEqual([true, false, true, true, false]);
  });
});
