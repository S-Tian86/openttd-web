import { vi } from 'vitest';
import { DEFAULT_GAME_OPTIONS, type GameOptions } from '../sim/game';
import { DiagDir } from '../sim/map/geometry';
import { Axis } from '../sim/track/track';
import type { GameSpeed, Locale, Tool, UiControls, UiSession, UiSnapshot } from './session';

/** A snapshot of a running game with nothing selected, for UI tests. */
export const BASE_SNAPSHOT: UiSnapshot = {
  year: 1950,
  month: 0,
  day: 1,
  money: 100000,
  loan: 100000,
  maxLoan: 300000,
  paused: false,
  speed: 'normal',
  locale: 'en',
  themeId: 'blocks',
  themes: [{ id: 'blocks', name: 'Blocks' }],
  controls: { scrollMode: 'mapRmb', wheel: 'zoom', wheelSpeed: 5 },
  generating: null,
  generationError: null,
  gameOptions: DEFAULT_GAME_OPTIONS,
  tool: null,
  window: null,
  removeMode: false,
  stationAxis: Axis.X,
  depotDir: DiagDir.NW,
  preview: null,
  error: null,
};

/** A session that returns `BASE_SNAPSHOT` with `snapshot` applied; every method is a mock. */
export function fakeSession(snapshot: Partial<UiSnapshot> = {}): UiSession {
  const s: UiSnapshot = { ...BASE_SNAPSHOT, ...snapshot };
  return {
    getSnapshot: () => s,
    subscribe: () => () => undefined,
    togglePause: vi.fn<() => void>(),
    setSpeed: vi.fn<(speed: GameSpeed) => void>(),
    setLocale: vi.fn<(locale: Locale) => void>(),
    setTheme: vi.fn<(id: string) => void>(),
    setControls: vi.fn<(controls: UiControls) => void>(),
    newGame: vi.fn<(options: GameOptions) => void>(),
    setTool: vi.fn<(tool: Tool | null) => void>(),
    openTown: vi.fn<(index: number) => void>(),
    closeWindow: vi.fn<() => void>(),
    setRemoveMode: vi.fn<(on: boolean) => void>(),
    setStationAxis: vi.fn<(axis: Axis) => void>(),
    setDepotDir: vi.fn<(dir: DiagDir) => void>(),
    confirmBuild: vi.fn<() => void>(),
    cancelBuild: vi.fn<() => void>(),
    dismissError: vi.fn<() => void>(),
    changeLoan: vi.fn<(action: 'borrow' | 'repay', all: boolean) => void>(),
  };
}
