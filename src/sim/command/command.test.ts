import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../game';
import { execute } from './command';

describe('commands (port of command.cpp)', () => {
  it('pauses and unpauses, and test mode changes nothing', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    expect(execute(game, { type: 'pause', paused: true }, 'test')).toEqual({ ok: true, cost: 0 });
    expect(game.paused).toBe(false);
    expect(execute(game, { type: 'pause', paused: true }, 'exec')).toEqual({ ok: true, cost: 0 });
    expect(game.paused).toBe(true);
    // Pause is a server setting (level 0): always allowed, even while paused.
    expect(execute(game, { type: 'pause', paused: false }, 'exec').ok).toBe(true);
    expect(game.paused).toBe(false);
  });
});
