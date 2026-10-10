import type { ErrorKey } from '../sim/command/cost';
import type { GameOptions } from '../sim/game';
import type { DiagDir } from '../sim/map/geometry';
import type { DepotInfo, IndustryInfo, StationInfo, TileInfo, TownInfo } from '../sim/query';
import type { Axis } from '../sim/track/track';

export type GameSpeed = 'normal' | 'x2' | 'x4' | 'fast';

export type Locale = 'en' | 'es';

export type Tool = 'query' | 'rail' | 'station' | 'depot' | 'demolish';

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
