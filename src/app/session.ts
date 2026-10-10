import { execute } from '../sim/command/command';
import { tick, type GameOptions, type GameState } from '../sim/game';
import { convertDateToYMD } from '../sim/time/date';
import { WorldGenerationError } from '../sim/world/errors';
import { generateGame, type GenerationProgress } from '../sim/world/generate';
import type { GameSpeed, Locale, UiSession, UiSnapshot } from '../ui/session';
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

  /** Starts a new world; a request that is still running is dropped (only the latest finishes). */
  newGame = (options: GameOptions): void => {
    this.generation = (this.deps.generate ?? generateGame)(options);
    this.generatingFraction = 0;
    this.generationError = null;
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
        this.clock.nextTickAt = 0;
        this.deps.onNewState(result.value);
        this.refresh();
        return;
      }
      this.generatingFraction = result.fraction;
    } catch (error) {
      this.generation = null;
      // A failed world keeps the current one (ruling R12); anything else is a bug.
      if (!(error instanceof WorldGenerationError)) throw error;
      this.generationError = error.key;
      this.refresh();
      return;
    }
    if (Math.round(this.generatingFraction * 100) !== before) this.refresh();
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
    };
  }

  private refresh(): void {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) listener();
  }
}
