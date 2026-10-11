import { execute } from '../sim/command/command';
import { tick, type GameOptions, type GameState } from '../sim/game';
import { describeTile, industryInfo, townInfo } from '../sim/query';
import { convertDateToYMD } from '../sim/time/date';
import { WorldGenerationError } from '../sim/world/errors';
import { generateGame, type GenerationProgress } from '../sim/world/generate';
import type { GameSpeed, Locale, Tool, UiSession, UiSnapshot, UiWindow } from '../ui/session';
import { GENERATION_SLICE_MS, runGenerationSlice } from './generation';
import { gameIntervalMs, SPEED_PERCENT, ticksDue, type LoopClock } from './loop';

export interface SessionDeps {
  locale: Locale;
  themes: readonly { id: string; name: string }[];
  themeId: string;
  onLocale(locale: Locale): void;
  onTheme(id: string): void;
  /** Called once for each finished world, so the renderer can show it. */
  onNewState(state: GameState): void;
  clock?: () => number;
  generate?: (options: GameOptions) => Generator<GenerationProgress, GameState, void>;
}

/** Owns the game state, runs ticks on time and feeds the UI. */
export class GameSession implements UiSession {
  private readonly listeners = new Set<() => void>();
  private readonly clock: LoopClock = { nextTickAt: 0 };
  private speed: GameSpeed = 'normal';
  private snapshot: UiSnapshot;
  private currentState: GameState;
  private locale: Locale;
  private themeId: string;
  private generation: Generator<GenerationProgress, GameState, void> | null = null;
  private generatingFraction = 0;
  private generationError: UiSnapshot['generationError'] = null;
  private tool: Tool | null = null;
  /** Which window is open; its data is rebuilt from the state on every refresh. */
  private windowRef:
    { kind: 'tile'; tile: number } | { kind: 'town' | 'industry'; index: number } | null = null;

  constructor(
    state: GameState,
    private readonly deps: SessionDeps,
  ) {
    this.currentState = state;
    this.locale = deps.locale;
    this.themeId = deps.themeId;
    this.snapshot = this.buildSnapshot();
  }

  get state(): GameState {
    return this.currentState;
  }

  getSnapshot = (): UiSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  togglePause = (): void => {
    execute(this.state, { type: 'pause', paused: !this.state.paused }, 'exec');
    this.refresh();
  };

  setSpeed = (speed: GameSpeed): void => {
    this.speed = speed;
    this.refresh();
  };

  setLocale = (locale: Locale): void => {
    this.locale = locale;
    this.deps.onLocale(locale);
    this.refresh();
  };

  setTheme = (id: string): void => {
    this.themeId = id;
    this.deps.onTheme(id);
    this.refresh();
  };

  setTool = (tool: Tool | null): void => {
    this.tool = tool;
    this.refresh();
  };

  openTown = (index: number): void => {
    this.windowRef = { kind: 'town', index };
    this.refresh();
  };

  closeWindow = (): void => {
    this.windowRef = null;
    this.refresh();
  };

  /** A tap or long press on a map tile: queries it when the tool is on or the press was long. */
  tapTile = (tile: number, long: boolean): void => {
    if (!long && this.tool !== 'query') return;
    const info = describeTile(this.state, tile);
    if (info.kind === 'house' && info.townIndex !== null) {
      this.windowRef = { kind: 'town', index: info.townIndex };
    } else if (info.kind === 'industry' && info.industryIndex !== null) {
      this.windowRef = { kind: 'industry', index: info.industryIndex };
    } else {
      this.windowRef = { kind: 'tile', tile };
    }
    this.refresh();
  };

  /** Starts a new world; a request that is still running is dropped (only the latest finishes). */
  newGame = (options: GameOptions): void => {
    this.generation = (this.deps.generate ?? generateGame)(options);
    this.generatingFraction = 0;
    this.generationError = null;
    this.windowRef = null;
    this.refresh();
  };

  /** Called every animation frame. Re-renders the UI only when something visible changed. */
  frame(now: number): void {
    if (this.generation !== null) {
      this.stepGeneration();
      return; // no ticks while a world is being generated
    }
    const interval = gameIntervalMs(this.state.paused, SPEED_PERCENT[this.speed]);
    const ticks = ticksDue(this.clock, now, interval);
    for (let i = 0; i < ticks; i++) tick(this.state);
    if (
      this.state.calendar.date !== this.lastDate ||
      this.state.company.money !== this.snapshot.money
    ) {
      this.refresh();
    }
  }

  private lastDate = -1;

  private stepGeneration(): void {
    const generation = this.generation!;
    const clock = this.deps.clock ?? ((): number => performance.now());
    const before = Math.round(this.generatingFraction * 100);
    try {
      const result = runGenerationSlice(generation, clock() + GENERATION_SLICE_MS, clock);
      if (result.done) {
        this.generation = null;
        this.currentState = result.value;
        this.windowRef = null;
        this.clock.nextTickAt = 0;
        this.deps.onNewState(result.value);
        this.refresh();
        return;
      }
      this.generatingFraction = result.fraction;
    } catch (error) {
      this.generation = null;
      // A failed world keeps the current one (ruling R12); anything else is a bug. The UI must
      // not stay on "Generating…", so it is refreshed before the error goes on to the caller.
      if (!(error instanceof WorldGenerationError)) {
        this.refresh();
        throw error;
      }
      this.generationError = error.key;
      this.refresh();
      return;
    }
    if (Math.round(this.generatingFraction * 100) !== before) this.refresh();
  }

  private buildWindow(): UiWindow | null {
    const ref = this.windowRef;
    if (ref === null) return null;
    if (ref.kind === 'tile') {
      if (ref.tile >= this.state.map.size) return null;
      const info = describeTile(this.state, ref.tile);
      const town = info.townIndex === null ? null : townInfo(this.state, info.townIndex);
      return { kind: 'tile', info, townName: town === null ? null : town.name };
    }
    if (ref.kind === 'town') {
      const info = townInfo(this.state, ref.index);
      return info === null ? null : { kind: 'town', info };
    }
    const info = industryInfo(this.state, ref.index);
    return info === null ? null : { kind: 'industry', info };
  }

  private buildSnapshot(): UiSnapshot {
    const { year, month, day } = convertDateToYMD(this.state.calendar.date);
    this.lastDate = this.state.calendar.date;
    return {
      year,
      month,
      day,
      money: this.state.company.money,
      paused: this.state.paused,
      speed: this.speed,
      locale: this.locale,
      themeId: this.themeId,
      themes: this.deps.themes,
      generating: this.generation === null ? null : this.generatingFraction,
      generationError: this.generationError,
      gameOptions: this.state.options,
      tool: this.tool,
      window: this.buildWindow(),
    };
  }

  private refresh(): void {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) listener();
  }
}
