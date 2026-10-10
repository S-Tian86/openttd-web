import { describe, expect, it } from 'vitest';
import { gameIntervalMs, MAX_TICKS_PER_FRAME, SPEED_PERCENT, ticksDue } from './loop';

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

  it('drops a backlog after a stall', () => {
    const clock = { nextTickAt: 0 };
    expect(ticksDue(clock, 10_000, 27)).toBe(1);
    expect(clock.nextTickAt).toBe(10_027);
  });

  it('never runs more than MAX_TICKS_PER_FRAME in one frame, then drops the rest', () => {
    const clock = { nextTickAt: 0 };
    expect(ticksDue(clock, 50, 1.08)).toBe(MAX_TICKS_PER_FRAME);
    expect(clock.nextTickAt).toBe(50);
  });

  it('reaches full fast-forward speed at 60 frames per second', () => {
    const clock = { nextTickAt: 0 };
    const interval = gameIntervalMs(false, SPEED_PERCENT.fast);
    let total = 0;
    for (let f = 1; f <= 60; f++) total += ticksDue(clock, (f * 1000) / 60, interval);
    expect(total).toBeGreaterThanOrEqual(900);
    expect(total).toBeLessThanOrEqual(930);
  });

  it('keeps normal speed at 60 frames per second', () => {
    const clock = { nextTickAt: 0 };
    const interval = gameIntervalMs(false, SPEED_PERCENT.normal);
    let total = 0;
    for (let f = 1; f <= 60; f++) total += ticksDue(clock, (f * 1000) / 60, interval);
    expect(total).toBe(38);
  });
});
