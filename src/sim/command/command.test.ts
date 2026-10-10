import { describe, expect, it } from 'vitest';
import { createEmptyGame, hashGameState } from '../game';
import { execute, pauseLevel } from './command';

describe('commands (port of command.cpp)', () => {
  it('pauses and unpauses, and test mode changes nothing', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const before = hashGameState(game);
    expect(execute(game, { type: 'pause', paused: true }, 'test')).toEqual({ ok: true, cost: 0 });
    expect(game.paused).toBe(false);
    expect(hashGameState(game)).toBe(before); // test mode changes nothing
    expect(execute(game, { type: 'pause', paused: true }, 'exec')).toEqual({ ok: true, cost: 0 });
    expect(game.paused).toBe(true);
    // Pause is a server setting (level 0): always allowed, even while paused.
    expect(execute(game, { type: 'pause', paused: false }, 'exec').ok).toBe(true);
    expect(game.paused).toBe(false);
  });

  it('uses OpenTTD pause levels: construction 3, money 2, settings 0 (IsCommandAllowedWhilePaused)', () => {
    expect(
      (['pause', 'increaseLoan', 'decreaseLoan'] as const).map((type) => pauseLevel(type)),
    ).toEqual([0, 2, 2]);
  });
});
