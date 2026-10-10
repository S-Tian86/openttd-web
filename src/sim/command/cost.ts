import { ExpensesType } from '../economy/company';

/** Port of command_type.h:DoCommandFlag (the flags the port uses). */
export const DoFlag = { None: 0, Execute: 1, Auto: 2, NoWater: 4, ForceClearTile: 8 } as const;

/** Every error key a command can return; each needs a translation. */
export const ERROR_KEYS = [
  'error.notAllowedWhilePaused',
  'error.notEnoughCash',
  'error.maximumPermittedLoan',
  'error.loanAlreadyRepaid',
  'error.currencyRequired',
  'error.buildingMustBeDemolished',
  'error.cantBuildOnWater',
  'error.mustRemoveRoadFirst',
  'error.objectInTheWay',
  'error.clearingLimitReached',
  'error.localAuthorityRefuses',
  'error.alreadyBuilt',
  'error.mustRemoveRailroadTrack',
  'error.areaIsOwnedByAnother',
  'error.noRailroadTrack',
  'error.flatLandRequired',
  'error.adjoinsMoreThanOne',
  'error.stationTooSpreadOut',
  'error.mustDemolishRailroad',
  'error.noStation',
] as const;
export type ErrorKey = (typeof ERROR_KEYS)[number];

export interface CommandError {
  key: ErrorKey;
  params: Readonly<Record<string, number>>;
}

/** Port of command_type.h:CommandCost. `error: null` is CMD_ERROR (no message). */
export type CommandCost =
  | { ok: true; cost: number; expense: ExpensesType; extraCash: number }
  | { ok: false; error: CommandError | null };

export const succeed = (
  cost = 0,
  expense: ExpensesType = ExpensesType.Construction,
): CommandCost => ({ ok: true, cost, expense, extraCash: 0 });

export const fail = (key: ErrorKey, params: Record<string, number> = {}): CommandCost => ({
  ok: false,
  error: { key, params },
});

export const CMD_ERROR: CommandCost = { ok: false, error: null };

/**
 * Port of CommandCost::AddCost: the first error is kept. A failure carries no cost here, so the
 * accumulated cost of a failed total is not tracked.
 */
export function addCost(total: CommandCost, part: CommandCost): CommandCost {
  if (!total.ok) return total;
  if (!part.ok) return part;
  return { ...total, cost: total.cost + part.cost };
}
