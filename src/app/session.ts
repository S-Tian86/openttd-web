import type { BuildGesture } from '../render/gesture';
import type { MapPreview } from '../render/preview';
import { commandTile, execute, type Command } from '../sim/command/command';
import type { CommandError } from '../sim/command/cost';
import { checkCompanyHasMoney } from '../sim/economy/company';
import { tick, type GameOptions, type GameState } from '../sim/game';
import { DiagDir, isValidTile } from '../sim/map/geometry';
import { describeTile, industryInfo, townInfo } from '../sim/query';
import { convertDateToYMD } from '../sim/time/date';
import { depotExtraRail } from '../sim/track/depot';
import { Axis } from '../sim/track/track';
import { WorldGenerationError } from '../sim/world/errors';
import { generateGame, type GenerationProgress } from '../sim/world/generate';
import {
  isBuildTool,
  type GameSpeed,
  type Locale,
  type Tool,
  type UiCommandError,
  type UiError,
  type UiPreview,
  type UiSession,
  type UiSnapshot,
  type UiWindow,
} from '../ui/session';
import { planBuild, type BuildOptions, type PlannedBuild } from './construction';
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
  /** The construction ghost to draw, or null to clear it (R31). */
  onPreview?(preview: MapPreview | null): void;
  /** A construction command the player posted succeeded. */
  onExecuted?(command: Command, cost: number): void;
}

/** A command error with its parameters looked up for the UI (industry and town by index). */
export function toUiError(state: GameState, error: CommandError | null): UiCommandError | null {
  if (error === null) return null;
  const { money, industry, town } = error.params;
  return {
    key: error.key,
    money: money ?? null,
    industry: industry === undefined ? null : industryInfo(state, industry),
    town: town === undefined ? null : (townInfo(state, town)?.name ?? null),
  };
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
  private removeMode = false;
  // Port of rail_gui.cpp: _station_gui.axis is zero-initialised (AXIS_X); InitializeRailGui
  // sets _build_depot_direction = DIAGDIR_NW.
  private stationAxis: Axis = Axis.X;
  private depotDir: DiagDir = DiagDir.NW;
  private preview: UiPreview | null = null;
  /** The plan a finger left on the map, built by confirmBuild (R20). */
  private pending: PlannedBuild | null = null;
  private error: UiError | null = null;
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
    // Port of rail_gui.cpp:BuildRailToolbarWindow::OnClick: every tool button clears Remove.
    this.removeMode = false;
    this.clearBuild();
    this.refresh();
  };

  setRemoveMode = (on: boolean): void => {
    this.removeMode = on;
    this.clearBuild();
    this.refresh();
  };

  setStationAxis = (axis: Axis): void => {
    this.stationAxis = axis;
    this.clearBuild();
    this.refresh();
  };

  setDepotDir = (dir: DiagDir): void => {
    this.depotDir = dir;
    this.clearBuild();
    this.refresh();
  };

  /**
   * One step of a build-tool gesture: the command it would post is run in test mode to colour
   * the ghost and fill the cost bar (R31). The mouse builds on release, as OpenTTD's
   * OnPlaceMouseUp does; a finger leaves the preview waiting for Confirm (R20).
   */
  buildGesture = (g: BuildGesture): void => {
    const tool = this.tool;
    if (!isBuildTool(tool) || g.phase === 'cancel') return this.cancelBuild();
    const plan = planBuild(this.state.map, tool, this.buildOptions(), g.press, g.current, g.ctrl);
    const test = execute(this.state, plan.command, 'test');
    // `clearArea` is NO_TEST, so `execute` does not check the cash for it: checked here (R31).
    const ok = test.ok && checkCompanyHasMoney(this.state.company, test.cost);
    this.deps.onPreview?.({ ok, rails: plan.rails, tiles: plan.tiles });
    if (g.phase === 'hover') return;
    const preview: UiPreview = {
      ok,
      cost: test.ok ? test.cost : 0,
      error: test.ok ? null : toUiError(this.state, test.error),
      needsConfirm: false,
    };
    if (g.phase === 'move') {
      this.pending = null;
      this.preview = preview;
      this.refresh();
    } else if (g.touch) {
      this.pending = plan;
      this.preview = { ...preview, needsConfirm: true };
      this.refresh();
    } else {
      this.runBuild(plan);
    }
  };

  confirmBuild = (): void => {
    if (this.pending !== null) this.runBuild(this.pending);
  };

  cancelBuild = (): void => {
    this.clearBuild();
    this.refresh();
  };

  dismissError = (): void => {
    this.error = null;
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
        this.clearBuild(); // a plan for the old map must not be built on the new one
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

  private buildOptions(): BuildOptions {
    return { remove: this.removeMode, stationAxis: this.stationAxis, depotDir: this.depotDir };
  }

  /** Forgets the gesture's preview and any build waiting for Confirm, and clears the ghost. */
  private clearBuild(): void {
    this.pending = null;
    this.preview = null;
    this.deps.onPreview?.(null);
  }

  /** Posts a planned command as the GUI does: errors under the tool's header (error_gui.cpp). */
  private runBuild(plan: PlannedBuild): void {
    this.clearBuild();
    const result = execute(this.state, plan.command, 'exec');
    const tile = commandTile(plan.command);
    if (result.ok) {
      this.deps.onExecuted?.(plan.command, result.cost);
      if (plan.command.type === 'buildTrainDepot') this.placeExtraDepotRails(plan.command);
    } else if (tile !== null && tile !== 0 && !isValidTile(this.state.map, tile)) {
      // Port of command.cpp:InternalPost: an off-map or void first tile is refused silently.
    } else {
      this.error = { header: plan.header, detail: toUiError(this.state, result.error) };
    }
    this.refresh();
  }

  /**
   * Port of rail_gui.cpp:CcRailDepot: up to three single rails in front of the new depot,
   * each its own command; their errors are not shown.
   */
  private placeExtraDepotRails({ tile, dir }: { tile: number; dir: DiagDir }): void {
    for (const step of [0, 1, 2] as const) {
      const extra = depotExtraRail(this.state, tile, dir, step);
      if (extra !== null) {
        execute(this.state, { type: 'buildRail', tile: extra.tile, track: extra.track }, 'exec');
      }
    }
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
      removeMode: this.removeMode,
      stationAxis: this.stationAxis,
      depotDir: this.depotDir,
      preview: this.preview,
      error: this.error,
    };
  }

  private refresh(): void {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) listener();
  }
}
