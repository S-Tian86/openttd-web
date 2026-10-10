import { execute } from '../sim/command/command';
import { tick, type GameState } from '../sim/game';
import { convertDateToYMD } from '../sim/time/date';
import type { GameSpeed, Locale, UiSession, UiSnapshot } from '../ui/session';
import { gameIntervalMs, SPEED_PERCENT, ticksDue, type LoopClock } from './loop';

/** Owns the game state, runs ticks on time and feeds the UI. */
export class GameSession implements UiSession {
  private readonly listeners = new Set<() => void>();
  private readonly clock: LoopClock = { nextTickAt: 0 };
  private speed: GameSpeed = 'normal';
  private snapshot: UiSnapshot;

  constructor(
    readonly state: GameState,
    private locale: Locale,
    private readonly themes: readonly { id: string; name: string }[],
    private themeId: string,
    private readonly onLocale: (locale: Locale) => void,
    private readonly onTheme: (id: string) => void,
  ) {
    this.snapshot = this.buildSnapshot();
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
    this.onLocale(locale);
    this.refresh();
  };

  setTheme = (id: string): void => {
    this.themeId = id;
    this.onTheme(id);
    this.refresh();
  };

  /** Called every animation frame. Re-renders the UI only when something visible changed. */
  frame(now: number): void {
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
      themes: this.themes,
    };
  }

  private refresh(): void {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) listener();
  }
}
