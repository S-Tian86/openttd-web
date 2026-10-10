import { describe, expect, it, vi } from 'vitest';
import {
  createEmptyGame,
  DEFAULT_GAME_OPTIONS,
  hashGameState,
  type GameOptions,
  type GameState,
} from '../sim/game';
import { WorldGenerationError } from '../sim/world/errors';
import { createGame, type GenerationProgress } from '../sim/world/generate';
import type { Locale } from '../ui/session';
import { GameSession, type SessionDeps } from './session';

const OPTIONS: GameOptions = { ...DEFAULT_GAME_OPTIONS, mapLogX: 6, mapLogY: 6, seed: 9 };

const deps = (overrides: Partial<SessionDeps> = {}): SessionDeps => ({
  locale: 'en',
  themes: [],
  themeId: 'blocks',
  onLocale: vi.fn<(locale: Locale) => void>(),
  onTheme: vi.fn<(id: string) => void>(),
  onNewState: vi.fn<(state: GameState) => void>(),
  clock: () => 0,
  ...overrides,
});

// oxlint-disable-next-line require-yield -- throws before its first step on purpose
function* failing(): Generator<GenerationProgress, GameState, void> {
  throw new WorldGenerationError('error.noTownCreated');
}

function* endless(): Generator<GenerationProgress, GameState, void> {
  for (;;) yield { fraction: 0.5 };
}

const advancingClock = (): (() => number) => {
  let now = 0;
  return () => (now += 100);
};

describe('GameSession world generation', () => {
  it('generates in frames and hands the new world over', () => {
    const onNewState = vi.fn<(state: GameState) => void>();
    const session = new GameSession(
      createEmptyGame({ mapLogX: 6, mapLogY: 6 }),
      deps({ onNewState }),
    );
    session.newGame(OPTIONS);
    expect(session.getSnapshot().generating).toBe(0);
    session.frame(0);
    expect(onNewState).toHaveBeenCalledOnce();
    expect(hashGameState(session.state)).toBe(hashGameState(createGame(OPTIONS)));
    expect([session.getSnapshot().generating, session.getSnapshot().gameOptions]).toEqual([
      null,
      OPTIONS,
    ]);
  });

  it('lets only the latest request finish (Review Focus 2)', () => {
    const onNewState = vi.fn<(state: GameState) => void>();
    const session = new GameSession(
      createEmptyGame({ mapLogX: 6, mapLogY: 6 }),
      deps({ onNewState, clock: advancingClock() }),
    );
    session.newGame(OPTIONS);
    session.frame(0);
    const second = { ...OPTIONS, seed: 10 };
    session.newGame(second);
    for (let i = 0; i < 1000 && session.getSnapshot().generating !== null; i++) session.frame(0);
    expect(onNewState).toHaveBeenCalledOnce();
    expect(session.state.options.seed).toBe(10);
  });

  it('keeps the current world and reports why when generation fails (Review Focus 1)', () => {
    const before = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const session = new GameSession(before, deps({ generate: failing }));
    session.newGame(OPTIONS);
    session.frame(0);
    expect(session.state).toBe(before);
    expect([session.getSnapshot().generating, session.getSnapshot().generationError]).toEqual([
      null,
      'error.noTownCreated',
    ]);
  });

  it('does not run game ticks while generating', () => {
    const state = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const session = new GameSession(state, deps({ generate: endless, clock: advancingClock() }));
    session.newGame(OPTIONS);
    session.frame(0);
    session.frame(10_000);
    expect(state.tickCounter).toBe(0);
  });
});
