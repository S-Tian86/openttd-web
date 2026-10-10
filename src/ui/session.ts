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
}

export interface UiSession {
  getSnapshot(): UiSnapshot;
  subscribe(listener: () => void): () => void;
  togglePause(): void;
  setSpeed(speed: GameSpeed): void;
  setLocale(locale: Locale): void;
  setTheme(id: string): void;
}
