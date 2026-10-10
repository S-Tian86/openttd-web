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

/**
 * Lag treated as a stall (a hidden tab or a long pause), not a slow frame. Slow frames must
 * not reach this threshold: they are bounded by MAX_TICKS_PER_FRAME instead, so a 150-250 ms
 * frame on a slow device or in CI still runs the game at real-time speed.
 */
export const MAX_FRAME_LAG_MS = 1000;

/**
 * Ticks to run this frame. OpenTTD's driver drops any backlog older than ALLOWED_DRIFT
 * intervals (video_driver.cpp:VideoDriver::GameLoop); a browser only calls once per frame,
 * so the allowed lag is at least one slow frame. Catch-up is capped per frame and the rest
 * of the backlog is dropped, so a slow phone never freezes.
 */
export function ticksDue(clock: LoopClock, now: number, intervalMs: number): number {
  const allowedLag = Math.max(ALLOWED_DRIFT * intervalMs, MAX_FRAME_LAG_MS);
  if (clock.nextTickAt < now - allowedLag) clock.nextTickAt = now;
  let ticks = 0;
  while (now >= clock.nextTickAt && ticks < MAX_TICKS_PER_FRAME) {
    clock.nextTickAt += intervalMs;
    ticks++;
  }
  if (ticks === MAX_TICKS_PER_FRAME && now >= clock.nextTickAt) clock.nextTickAt = now;
  return ticks;
}
