import { checkCompanyHasMoney, ExpensesType, subtractMoneyFromCompany } from '../economy/company';
import { cmdDecreaseLoan, cmdIncreaseLoan, type LoanAmount } from '../economy/loan';
import type { GameState } from '../game';
import { clearArea, landscapeClear } from '../map/clear-tile';
import { COMPANY_FIRST } from '../map/map';
import { isValidTile } from '../map/geometry';
import { cmdBuildSingleRail, cmdRailTrackHelper, cmdRemoveSingleRail } from '../track/rail-cmd';
import type { Track } from '../track/track';
import { DoFlag, succeed, type CommandCost, type CommandError } from './cost';

export type Command =
  | { type: 'pause'; paused: boolean }
  | { type: 'increaseLoan'; amount: LoanAmount }
  | { type: 'decreaseLoan'; amount: LoanAmount }
  | { type: 'landscapeClear'; tile: number }
  | { type: 'clearArea'; endTile: number; startTile: number; diagonal: boolean }
  | { type: 'buildRail'; tile: number; track: Track }
  | { type: 'removeRail'; tile: number; track: Track }
  | { type: 'buildRailroadTrack'; endTile: number; startTile: number; track: Track }
  | { type: 'removeRailroadTrack'; endTile: number; startTile: number; track: Track };
export type CommandMode = 'test' | 'exec';
export type CommandResult = { ok: true; cost: number } | { ok: false; error: CommandError | null };

/** construction.command_pause_level default: no construction while paused (time.md §4.8). */
export const COMMAND_PAUSE_LEVEL = 1;

type CommandType = 'serverSetting' | 'moneyManagement' | 'landscapeConstruction';

const COMMAND_TYPE: Record<Command['type'], CommandType> = {
  pause: 'serverSetting',
  increaseLoan: 'moneyManagement',
  decreaseLoan: 'moneyManagement',
  landscapeClear: 'landscapeConstruction',
  clearArea: 'landscapeConstruction',
  buildRail: 'landscapeConstruction',
  removeRail: 'landscapeConstruction',
  buildRailroadTrack: 'landscapeConstruction',
  removeRailroadTrack: 'landscapeConstruction',
};

/** Port of command.cpp:IsCommandAllowedWhilePaused: pause level per command type. */
const PAUSE_LOOKUP: Record<CommandType, number> = {
  serverSetting: 0,
  moneyManagement: 2,
  landscapeConstruction: 3,
};

/** The command's own CommandFlags as DoFlags (Auto, NoWater). */
const COMMAND_FLAGS: Record<Command['type'], number> = {
  pause: 0,
  increaseLoan: 0,
  decreaseLoan: 0,
  landscapeClear: 0,
  clearArea: 0,
  buildRail: DoFlag.Auto | DoFlag.NoWater,
  removeRail: DoFlag.Auto,
  buildRailroadTrack: DoFlag.Auto | DoFlag.NoWater,
  removeRailroadTrack: DoFlag.Auto,
};

/** Commands flagged CommandFlag::NoTest: the test run is skipped. */
const NO_TEST: ReadonlySet<Command['type']> = new Set(['clearArea']);

export const pauseLevel = (type: Command['type']): number => PAUSE_LOOKUP[COMMAND_TYPE[type]];

/** The command's first TileIndex parameter, or null when it has none. */
export function commandTile(command: Command): number | null {
  switch (command.type) {
    case 'pause':
    case 'increaseLoan':
    case 'decreaseLoan':
      return null;
    case 'landscapeClear':
    case 'buildRail':
    case 'removeRail':
      return command.tile;
    case 'clearArea':
    case 'buildRailroadTrack':
    case 'removeRailroadTrack':
      return command.endTile;
    default: {
      const unreachable: never = command;
      return unreachable;
    }
  }
}

function run(state: GameState, command: Command, flags: number): CommandCost {
  switch (command.type) {
    case 'pause':
      // Port of misc_cmd.cpp:CmdPause (PauseMode::Normal only).
      if ((flags & DoFlag.Execute) !== 0) state.paused = command.paused;
      return succeed(0, ExpensesType.Other);
    case 'increaseLoan':
      return cmdIncreaseLoan(state, flags, command.amount);
    case 'decreaseLoan':
      return cmdDecreaseLoan(state, flags, command.amount);
    case 'landscapeClear':
      return landscapeClear(state, command.tile, flags, COMPANY_FIRST);
    case 'clearArea':
      return clearArea(
        state,
        flags,
        command.endTile,
        command.startTile,
        command.diagonal,
        COMPANY_FIRST,
      );
    case 'buildRail':
      return cmdBuildSingleRail(state, flags, command.tile, command.track);
    case 'removeRail':
      return cmdRemoveSingleRail(state, flags, command.tile, command.track, COMPANY_FIRST);
    case 'buildRailroadTrack':
      return cmdRailTrackHelper(
        state,
        flags,
        command.startTile,
        command.endTile,
        command.track,
        false,
      );
    case 'removeRailroadTrack':
      return cmdRailTrackHelper(
        state,
        flags,
        command.startTile,
        command.endTile,
        command.track,
        true,
      );
    default: {
      const unreachable: never = command;
      return unreachable;
    }
  }
}

/**
 * Runs a command in test or exec mode (single player). Port of
 * command.cpp:CommandHelperBase::InternalPost / InternalExecuteProcessResult.
 */
export function execute(state: GameState, command: Command, mode: CommandMode): CommandResult {
  // "do not even think about executing out-of-bounds tile-commands"
  const tile = commandTile(command);
  if (tile !== null && tile !== 0 && !isValidTile(state.map, tile)) {
    return { ok: false, error: null };
  }
  if (state.paused && pauseLevel(command.type) > COMMAND_PAUSE_LEVEL) {
    return { ok: false, error: { key: 'error.notAllowedWhilePaused', params: {} } };
  }
  const flags = COMMAND_FLAGS[command.type];
  const test = run(state, command, flags);
  if (!test.ok) return { ok: false, error: test.error };
  if (!NO_TEST.has(command.type) && !checkCompanyHasMoney(state.company, test.cost)) {
    return { ok: false, error: { key: 'error.notEnoughCash', params: { money: test.cost } } };
  }
  if (mode === 'test') return { ok: true, cost: test.cost };
  const res = run(state, command, flags | DoFlag.Execute);
  if (!res.ok) return { ok: false, error: res.error };
  if (res.extraCash !== 0 && res.cost === 0) {
    return { ok: false, error: { key: 'error.notEnoughCash', params: { money: res.extraCash } } };
  }
  subtractMoneyFromCompany(state.company, res.cost, res.expense);
  return { ok: true, cost: res.cost };
}
