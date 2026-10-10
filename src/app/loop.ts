import type { GameSpeed } from '../ui/session';
export { MILLISECONDS_PER_TICK } from '../sim/core/constants';
import { MILLISECONDS_PER_TICK } from '../sim/core/constants';

/** Port of video_driver.hpp:ALLOWED_DRIFT. */
export const ALLOWED_DRIFT = 5;
/** Keeps a slow frame from running thousands of ticks (browser-only guard). */
export const MAX_TICKS_PER_FRAME = 32;

/** Game speed in percent (OpenTTD's _game_speed); 2500 is the default fast-forward limit. */
export const SPEED_PERCENT: Record<GameSpeed, number> = {
  normal: 100,
  x2: 200,
  x4: 400,
  fast: 2500,
};

/** Port of video_driver.hpp:GetGameInterval, in milliseconds. */
export function gameIntervalMs(paused: boolean, speedPercent: number): number {
  if (paused) return MILLISECONDS_PER_TICK;
  return (MILLISECONDS_PER_TICK * 100) / speedPercent;
}

export interface LoopClock {
  nextTickAt: number;
}

/** Ticks to run now. Port of video_driver.cpp:VideoDriver::GameLoop, called until caught up. */
export function ticksDue(clock: LoopClock, now: number, intervalMs: number): number {
  let ticks = 0;
  while (now >= clock.nextTickAt && ticks < MAX_TICKS_PER_FRAME) {
    clock.nextTickAt += intervalMs;
    if (clock.nextTickAt < now - ALLOWED_DRIFT * intervalMs) clock.nextTickAt = now;
    ticks++;
  }
  return ticks;
}
