import { describe, expect, it, vi } from 'vitest';
import {
  createEmptyGame,
  DEFAULT_GAME_OPTIONS,
  hashGameState,
  type GameOptions,
  type GameState,
} from '../sim/game';
import { makeHouseTile } from '../sim/map/house-map';
import { makeIndustry } from '../sim/map/industry-map';
import { tileXY } from '../sim/map/map';
import { newTown } from '../sim/town/town';
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

  it('leaves the generating state when the generator throws a plain error', () => {
    const before = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const bug = new Error('bug');
    // oxlint-disable-next-line require-yield -- throws before its first step on purpose
    const crashing = function* (): Generator<GenerationProgress, GameState, void> {
      throw bug;
    };
    const session = new GameSession(before, deps({ generate: crashing }));
    const listener = vi.fn<() => void>();
    session.subscribe(listener);
    session.newGame(OPTIONS);
    listener.mockClear();
    expect(() => session.frame(0)).toThrow(bug);
    expect(session.state).toBe(before);
    expect(session.getSnapshot().generating).toBeNull();
    expect(listener).toHaveBeenCalled();
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

function queryWorld(): GameState {
  const state = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  state.towns.push(newTown(0, tileXY(state.map, 20, 20), 0, false));
  makeHouseTile(state.map, tileXY(state.map, 21, 20), 0, 0, 3, 0x06, 0);
  state.industries.push({
    index: 0,
    type: 0,
    tile: tileXY(state.map, 40, 10),
    width: 3,
    height: 3,
    townIndex: 0,
    layoutIndex: 0,
    productionRate: 15,
    counter: 0,
    randomColour: 0,
    random: 0,
    prodLevel: 16,
  });
  makeIndustry(state.map, tileXY(state.map, 40, 10), 0, 5, 0);
  return state;
}

describe('GameSession query tool', () => {
  it('ignores a plain tap while the tool is off, but a long press queries', () => {
    const state = queryWorld();
    const session = new GameSession(state, deps());
    session.tapTile(tileXY(state.map, 10, 10), false);
    expect(session.getSnapshot().window).toBeNull();
    session.tapTile(tileXY(state.map, 10, 10), true);
    expect(session.getSnapshot().window).toMatchObject({ kind: 'tile' });
  });

  it('opens town and industry windows from house and industry tiles', () => {
    const state = queryWorld();
    const session = new GameSession(state, deps());
    session.setTool('query');
    expect(session.getSnapshot().tool).toBe('query');
    session.tapTile(tileXY(state.map, 21, 20), false);
    expect(session.getSnapshot().window).toMatchObject({ kind: 'town', info: { index: 0 } });
    session.tapTile(tileXY(state.map, 40, 10), false);
    expect(session.getSnapshot().window).toMatchObject({ kind: 'industry', info: { index: 0 } });
    session.closeWindow();
    expect(session.getSnapshot().window).toBeNull();
  });

  it('rebuilds the window from the live state', () => {
    const state = queryWorld();
    const session = new GameSession(state, deps());
    session.openTown(0);
    state.towns[0]!.population = 99;
    session.setTool(null);
    expect(session.getSnapshot().window).toMatchObject({ info: { population: 99 } });
  });
});
