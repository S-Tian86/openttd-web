import { describe, expect, it, vi } from 'vitest';
import type { BuildGesture } from '../render/gesture';
import type { MapPreview } from '../render/preview';
import type { OttdPoint } from '../render/projection';
import { execute, type Command } from '../sim/command/command';
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
import { getTrackBits } from '../sim/map/rail-map';
import { Track, TrackBits } from '../sim/track/track';
import { industryInfo, townInfo } from '../sim/query';
import { newTown } from '../sim/town/town';
import { WorldGenerationError } from '../sim/world/errors';
import { createGame, type GenerationProgress } from '../sim/world/generate';
import type { Locale } from '../ui/session';
import { GameSession, toUiError, type SessionDeps } from './session';

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

const P = (tx: number, ty: number, fx = 8, fy = 8): OttdPoint => ({
  x: tx * 16 + fx,
  y: ty * 16 + fy,
});
const gesture = (
  phase: BuildGesture['phase'],
  press: OttdPoint,
  current: OttdPoint,
  touch = false,
): BuildGesture => ({ phase, press, current, touch, ctrl: false });
const builder = (overrides: Partial<SessionDeps> = {}): GameSession => {
  const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  game.towns.push(newTown(0, tileXY(game.map, 20, 20), 0, false));
  return new GameSession(game, deps(overrides));
};
const DRAG: Command = {
  type: 'buildRailroadTrack',
  endTile: 14 + (10 << 6),
  startTile: 10 + (10 << 6),
  track: Track.X,
}; // tileXY(64-wide map, x, 10)

describe('GameSession construction (R20, R25, R31)', () => {
  it('previews a mouse drag with its cost and builds on release', () => {
    const onPreview = vi.fn<(p: MapPreview | null) => void>();
    const onExecuted = vi.fn<(c: Command, cost: number) => void>();
    const session = builder({ onPreview, onExecuted });
    session.setTool('rail');
    session.buildGesture(gesture('move', P(10, 10), P(14, 10)));
    expect(session.getSnapshot().preview).toEqual({
      ok: true,
      cost: 450,
      error: null,
      needsConfirm: false,
    });
    expect(onPreview.mock.lastCall?.[0]).toMatchObject({ ok: true, tiles: [] });
    expect(onPreview.mock.lastCall?.[0]?.rails).toHaveLength(5);
    session.buildGesture(gesture('end', P(10, 10), P(14, 10)));
    expect([session.state.company.money, session.getSnapshot().preview]).toEqual([99550, null]);
    expect(onPreview).toHaveBeenLastCalledWith(null);
    expect(onExecuted).toHaveBeenCalledWith(DRAG, 450);
  });

  it('keeps a finger drag as a preview until Confirm, then builds exactly that (Review Focus 1)', () => {
    const onExecuted = vi.fn<(c: Command, cost: number) => void>();
    const session = builder({ onExecuted });
    session.setTool('rail');
    session.buildGesture(gesture('move', P(10, 10), P(14, 10), true));
    session.buildGesture(gesture('end', P(10, 10), P(14, 10), true));
    expect([session.state.company.money, session.getSnapshot().preview?.needsConfirm]).toEqual([
      100000,
      true,
    ]);
    session.confirmBuild();
    expect(session.state.company.money).toBe(99550);
    expect(onExecuted.mock.calls).toEqual([[DRAG, 450]]);
  });

  it('keeps a plan waiting for Confirm when the next finger gesture turns into a pinch (C1)', () => {
    const onPreview = vi.fn<(p: MapPreview | null) => void>();
    const onExecuted = vi.fn<(c: Command, cost: number) => void>();
    const session = builder({ onPreview, onExecuted });
    session.setTool('rail');
    session.buildGesture(gesture('move', P(10, 10), P(14, 10), true));
    session.buildGesture(gesture('end', P(10, 10), P(14, 10), true));
    const waiting = session.getSnapshot().preview;
    const ghost = onPreview.mock.lastCall?.[0];
    // The pinch's first finger arrives alone and starts a build, then the second cancels it.
    session.buildGesture(gesture('move', P(20, 30), P(20, 30), true));
    session.buildGesture(gesture('cancel', P(20, 30), P(20, 30), true));
    expect(session.getSnapshot().preview).toEqual(waiting);
    expect(onPreview.mock.lastCall?.[0]).toEqual(ghost);
    session.confirmBuild();
    expect(onExecuted.mock.calls).toEqual([[DRAG, 450]]);
  });

  it('replaces a plan waiting for Confirm with the next finger gesture that ends', () => {
    const onExecuted = vi.fn<(c: Command, cost: number) => void>();
    const session = builder({ onExecuted });
    session.setTool('rail');
    session.buildGesture(gesture('end', P(10, 10), P(14, 10), true));
    session.buildGesture(gesture('move', P(10, 12), P(14, 12), true));
    session.buildGesture(gesture('end', P(10, 12), P(14, 12), true));
    session.buildGesture(gesture('move', P(20, 30), P(20, 30), true));
    session.buildGesture(gesture('cancel', P(20, 30), P(20, 30), true));
    session.confirmBuild();
    expect(onExecuted.mock.calls).toEqual([
      [
        {
          type: 'buildRailroadTrack',
          endTile: 14 + (12 << 6),
          startTile: 10 + (12 << 6),
          track: Track.X,
        },
        450,
      ],
    ]);
  });

  it('cancels a pending preview without building', () => {
    const session = builder();
    session.setTool('rail');
    session.buildGesture(gesture('end', P(10, 10), P(14, 10), true));
    session.cancelBuild();
    session.confirmBuild(); // nothing pending any more
    expect([session.state.company.money, session.getSnapshot().preview]).toEqual([100000, null]);
  });

  it('says why nothing is built while paused (R24, Review Focus 4)', () => {
    const session = builder();
    session.togglePause();
    session.setTool('rail');
    session.buildGesture(gesture('move', P(10, 10), P(14, 10)));
    const paused = { key: 'error.notAllowedWhilePaused', money: null, industry: null, town: null };
    expect(session.getSnapshot().preview).toEqual({
      ok: false,
      cost: 0,
      error: paused,
      needsConfirm: false,
    });
    session.buildGesture(gesture('end', P(10, 10), P(14, 10)));
    expect(session.getSnapshot().error).toEqual({ header: 'header.cantBuildRail', detail: paused });
    expect(session.state.company.money).toBe(100000);
    session.dismissError();
    expect(session.getSnapshot().error).toBeNull();
  });

  it('turns the ghost red and names the amount when the cash is short (R31)', () => {
    const session = builder();
    session.state.company.money = 449;
    session.setTool('rail');
    session.buildGesture(gesture('move', P(10, 10), P(14, 10)));
    expect(session.getSnapshot().preview).toEqual({
      ok: false,
      cost: 0,
      error: { key: 'error.notEnoughCash', money: 450, industry: null, town: null },
      needsConfirm: false,
    });
  });

  it('turns a demolition ghost red when the cash is short, though clearArea skips the check (R31)', () => {
    const onPreview = vi.fn<(p: MapPreview | null) => void>();
    const session = builder({ onPreview });
    session.state.company.money = 0;
    session.setTool('demolish');
    session.buildGesture(gesture('move', P(10, 10), P(10, 10)));
    expect(onPreview.mock.lastCall?.[0]?.ok).toBe(false);
    expect(session.getSnapshot().preview).toMatchObject({ ok: false, error: null });
    expect(session.getSnapshot().preview?.cost).toBeGreaterThan(0);
  });

  it('adds the follow-up rails after a depot (CcRailDepot)', () => {
    const session = builder();
    execute(
      session.state,
      { type: 'buildRail', tile: tileXY(session.state.map, 10, 9), track: Track.X },
      'exec',
    );
    session.setTool('depot'); // exit NW by default (InitializeRailGui)
    session.buildGesture(gesture('end', P(10, 10), P(10, 10)));
    expect(getTrackBits(session.state.map, tileXY(session.state.map, 10, 9))).toBe(
      TrackBits.X | TrackBits.Right | TrackBits.Lower,
    );
    expect(session.state.company.money).toBe(100000 - 90 - 540 - 75 - 75);
  });

  it('does nothing, silently, for a drag that ends on the map edge (InternalPost)', () => {
    const session = builder();
    session.setTool('rail');
    session.buildGesture(gesture('end', P(3, 10), P(0, 10)));
    expect([session.state.company.money, session.getSnapshot().error]).toEqual([100000, null]);
  });

  it('clears the ghost when the tool changes', () => {
    const onPreview = vi.fn<(p: MapPreview | null) => void>();
    const session = builder({ onPreview });
    session.setTool('rail');
    session.buildGesture(gesture('move', P(10, 10), P(14, 10)));
    session.setTool('station');
    expect([session.getSnapshot().preview, onPreview.mock.lastCall?.[0]]).toEqual([null, null]);
    expect([session.getSnapshot().stationAxis, session.getSnapshot().depotDir]).toEqual([0, 3]);
  });
});

describe('GameSession construction state', () => {
  it('names the industry and the town of an error (Task 2: the industry type)', () => {
    const state = queryWorld();
    expect([
      toUiError(state, { key: 'error.objectInTheWay', params: { industry: 0 } }),
      toUiError(state, { key: 'error.localAuthorityRefuses', params: { town: 0 } }),
      toUiError(state, null),
    ]).toEqual([
      {
        key: 'error.objectInTheWay',
        money: null,
        industry: industryInfo(state, 0),
        town: null,
      },
      {
        key: 'error.localAuthorityRefuses',
        money: null,
        industry: null,
        town: townInfo(state, 0)!.name,
      },
      null,
    ]);
  });

  it('turns the remove toggle off when a tool is chosen (rail_gui.cpp OnClick)', () => {
    const session = builder();
    session.setTool('rail');
    session.setRemoveMode(true);
    expect(session.getSnapshot().removeMode).toBe(true);
    session.setTool('station');
    expect(session.getSnapshot().removeMode).toBe(false);
  });

  it('drops a build waiting for Confirm when a new world arrives', () => {
    const session = builder();
    session.setTool('rail');
    session.buildGesture(gesture('end', P(10, 10), P(14, 10), true));
    session.newGame(OPTIONS);
    session.frame(0);
    expect(session.getSnapshot().preview).toBeNull();
    const money = session.state.company.money;
    session.confirmBuild(); // a kept plan would build (money) or fail (error) on the new map
    expect([session.state.company.money, session.getSnapshot().error]).toEqual([money, null]);
  });
});

describe('GameSession loan (economy.md §4.8)', () => {
  it('borrows and repays through commands and shows the loan', () => {
    const session = builder();
    session.changeLoan('borrow', false);
    expect([
      session.getSnapshot().money,
      session.getSnapshot().loan,
      session.getSnapshot().maxLoan,
    ]).toEqual([110000, 110000, 300000]);
    session.changeLoan('borrow', true);
    expect(session.getSnapshot().loan).toBe(300000);
    session.state.company.money = 95500;
    session.state.company.currentLoan = 100000;
    session.changeLoan('repay', true); // never more than the cash (Review Focus 2)
    expect([session.state.company.money, session.state.company.currentLoan]).toEqual([5500, 10000]);
  });

  it('refuses the loan while paused with OpenTTD headers (R24, Review Focus 4)', () => {
    const session = builder();
    session.togglePause();
    session.changeLoan('borrow', false);
    expect(session.getSnapshot().error).toEqual({
      header: 'header.cantBorrow',
      detail: { key: 'error.notAllowedWhilePaused', money: null, industry: null, town: null },
    });
    expect(session.getSnapshot().loan).toBe(100000);
  });
});
