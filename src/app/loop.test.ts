import { describe, expect, it } from 'vitest';
import {
  ALLOWED_DRIFT,
  gameIntervalMs,
  MAX_TICKS_PER_FRAME,
  SPEED_PERCENT,
  ticksDue,
} from './loop';

describe('pacing (port of video_driver.cpp:GameLoop and GetGameInterval)', () => {
  it('uses 27 ms per tick at normal speed and when paused', () => {
    expect(gameIntervalMs(false, SPEED_PERCENT.normal)).toBe(27);
    expect(gameIntervalMs(true, SPEED_PERCENT.fast)).toBe(27);
    expect(gameIntervalMs(false, SPEED_PERCENT.fast)).toBeCloseTo(1.08);
  });

  it('runs one tick per elapsed interval', () => {
    const clock = { nextTickAt: 0 };
    expect(ticksDue(clock, 0, 27)).toBe(1);
    expect(ticksDue(clock, 26, 27)).toBe(0);
    expect(ticksDue(clock, 81, 27)).toBe(3);
    expect(clock.nextTickAt).toBe(108);
  });

  it('drops a backlog older than ALLOWED_DRIFT intervals', () => {
    const clock = { nextTickAt: 0 };
    const ticks = ticksDue(clock, 10_000, 27);
    expect(ticks).toBeLessThanOrEqual(ALLOWED_DRIFT + 1);
    expect(clock.nextTickAt).toBeGreaterThan(10_000);
  });

  it('never runs more than MAX_TICKS_PER_FRAME in one frame', () => {
    const clock = { nextTickAt: 0 };
    expect(ticksDue(clock, 100, 1.08)).toBeLessThanOrEqual(MAX_TICKS_PER_FRAME);
  });
});
