import type { ErrorKey } from '../sim/command/cost';
import type { GameOptions } from '../sim/game';
import type { DiagDir } from '../sim/map/geometry';
import type { DepotInfo, IndustryInfo, StationInfo, TileInfo, TownInfo } from '../sim/query';
import type { Axis } from '../sim/track/track';

export type GameSpeed = 'normal' | 'x2' | 'x4' | 'fast';

export type Locale = 'en' | 'es';

export type Tool = 'query' | 'rail' | 'station' | 'depot' | 'demolish';

/** OpenTTD's viewport scroll behaviour (gui.scroll_mode), in its settings window order. */
export const SCROLL_MODES = ['viewportRmbLocked', 'mapRmbLocked', 'mapRmb', 'mapLmb'] as const;
export type ScrollMode = (typeof SCROLL_MODES)[number];

/** OpenTTD's function of the scroll wheel (gui.scrollwheel_scrolling). */
export const WHEEL_MODES = ['zoom', 'scroll', 'off'] as const;
export type WheelMode = (typeof WHEEL_MODES)[number];

/** OpenTTD's map scroll wheel speed (gui.scrollwheel_multiplier), 1 to 15. */
export const WHEEL_SPEEDS: readonly number[] = Array.from({ length: 15 }, (_, i) => i + 1);

/** OpenTTD's tooltip delay (gui.hover_delay_ms): 0 for the right click, or 50 to 6000 ms by 50. */
export const HOVER_DELAYS: readonly number[] = [
  0,
  ...Array.from({ length: 120 }, (_, i) => 50 * (i + 1)),
];

/** The control settings shown in the settings window. */
export interface UiControls {
  scrollMode: ScrollMode;
  wheel: WheelMode;
  wheelSpeed: number;
  hoverDelay: number;
}

export const isBuildTool = (tool: Tool | null): tool is 'rail' | 'station' | 'depot' | 'demolish' =>
  tool !== null && tool !== 'query';

/** A command's error detail with its parameters resolved to what the message shows. */
export interface UiCommandError {
  key: ErrorKey;
  money: number | null;
  industry: IndustryInfo | null;
  town: string | null;
}

/** The test run of the gesture in progress: its cost, or why it would fail (R31). */
export interface UiPreview {
  ok: boolean;
  cost: number;
  error: UiCommandError | null;
  /** A finger lifted: the build waits for Confirm (R20). */
  needsConfirm: boolean;
}

/** The first line of OpenTTD's error window: what failed. */
export type ErrorHeader =
  | 'header.cantBuildRail'
  | 'header.cantRemoveRail'
  | 'header.cantBuildStation'
  | 'header.cantRemoveStationPart'
  | 'header.cantBuildDepot'
  | 'header.cantClearArea'
  | 'header.cantBorrow'
  | 'header.cantRepay';

/** Port of error_gui.cpp's error window: a header and, when the command gave one, a detail. */
export interface UiError {
  header: ErrorHeader;
  detail: UiCommandError | null;
}

export type UiWindow =
  | {
      kind: 'tile';
      info: TileInfo;
      townName: string | null;
      station: StationInfo | null;
      depot: DepotInfo | null;
    }
  | { kind: 'town'; info: TownInfo }
  | { kind: 'industry'; info: IndustryInfo };

export interface UiSnapshot {
  year: number;
  month: number;
  day: number;
  money: number;
  loan: number;
  maxLoan: number;
  paused: boolean;
  speed: GameSpeed;
  locale: Locale;
  themeId: string;
  themes: readonly { id: string; name: string }[];
  controls: UiControls;
  /** World generation progress 0..1, or null when idle. */
  generating: number | null;
  generationError: 'error.noTownCreated' | null;
  /** Options of the world being played. */
  gameOptions: GameOptions;
  tool: Tool | null;
  window: UiWindow | null;
  removeMode: boolean;
  stationAxis: Axis;
  depotDir: DiagDir;
  preview: UiPreview | null;
  error: UiError | null;
}

export interface UiSession {
  getSnapshot(): UiSnapshot;
  subscribe(listener: () => void): () => void;
  togglePause(): void;
  setSpeed(speed: GameSpeed): void;
  setLocale(locale: Locale): void;
  setTheme(id: string): void;
  setControls(controls: UiControls): void;
  /** Starts generating a new world in the background; replaces a running request. */
  newGame(options: GameOptions): void;
  setTool(tool: Tool | null): void;
  openTown(index: number): void;
  closeWindow(): void;
  setRemoveMode(on: boolean): void;
  setStationAxis(axis: Axis): void;
  setDepotDir(dir: DiagDir): void;
  /** Builds the preview a finger left waiting (R20). */
  confirmBuild(): void;
  cancelBuild(): void;
  dismissError(): void;
  /** Borrows or repays one loan step, or as much as possible when `all` (company_gui.cpp). */
  changeLoan(action: 'borrow' | 'repay', all: boolean): void;
}
