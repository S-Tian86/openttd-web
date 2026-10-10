import type { GameOptions } from '../sim/game';

export type GameSpeed = 'normal' | 'x2' | 'x4' | 'fast';

export type Locale = 'en' | 'es';

export interface UiSnapshot {
  year: number;
  month: number;
  day: number;
  money: number;
  paused: boolean;
  speed: GameSpeed;
  locale: Locale;
  themeId: string;
  themes: readonly { id: string; name: string }[];
  /** World generation progress 0..1, or null when idle. */
  generating: number | null;
  generationError: 'error.noTownCreated' | null;
  /** Options of the world being played. */
  gameOptions: GameOptions;
}

export interface UiSession {
  getSnapshot(): UiSnapshot;
  subscribe(listener: () => void): () => void;
  togglePause(): void;
  setSpeed(speed: GameSpeed): void;
  setLocale(locale: Locale): void;
  setTheme(id: string): void;
  /** Starts generating a new world in the background; replaces a running request. */
  newGame(options: GameOptions): void;
}
