import { INFLATION_ONE } from './prices';

/** Port of economy_type.h. */
export const LOAN_INTERVAL = 10000;
export const INITIAL_LOAN = 100000;
/** difficulty.max_loan default (difficulty_settings.ini), before inflation. */
export const DEFAULT_MAX_LOAN = 300000;

/** Port of economy_type.h:ExpensesType. */
export const ExpensesType = {
  Construction: 0,
  NewVehicles: 1,
  TrainRun: 2,
  RoadVehRun: 3,
  AircraftRun: 4,
  ShipRun: 5,
  Property: 6,
  TrainRevenue: 7,
  RoadVehRevenue: 8,
  AircraftRevenue: 9,
  ShipRevenue: 10,
  LoanInterest: 11,
  Other: 12,
} as const;
export type ExpensesType = (typeof ExpensesType)[keyof typeof ExpensesType];
export const EXPENSES_END = 13;

/** Port of company_cmd.cpp: Company::Company starts with a full clearing allowance. */
export const CLEAR_FRAME_BURST = 4096;
/** Port of company_cmd.cpp:UpdateLandscapingLimit: 64 tiles regained per tick (16.16). */
export const CLEAR_PER_64K_FRAMES = 64 << 16;

export interface CompanyState {
  money: number;
  currentLoan: number;
  maxLoan: number;
  /** Port of Company::clear_limit (16.16 fixed point, tiles). */
  clearLimit: number;
  /** Port of Company::yearly_expenses: three years of EXPENSES_END entries, newest first. */
  yearlyExpenses: number[][];
  infrastructure: { rail: number; station: number };
}

/** Port of economy.cpp:RecomputePrices (max loan part). */
export function economyMaxLoan(maxLoanSetting: number, inflationPrices: number): number {
  return (
    Math.floor(Math.floor((maxLoanSetting * inflationPrices) / 65536) / LOAN_INTERVAL) *
    LOAN_INTERVAL
  );
}

/** Port of company_cmd.cpp:DoStartupNewCompany (money part): cash = loan = initial loan. */
export function createCompany(maxLoan: number): CompanyState {
  const loan = Math.min(economyMaxLoan(INITIAL_LOAN, INFLATION_ONE), maxLoan);
  return {
    money: loan,
    currentLoan: loan,
    maxLoan,
    clearLimit: CLEAR_FRAME_BURST << 16,
    yearlyExpenses: Array.from({ length: 3 }, () => Array.from({ length: EXPENSES_END }, () => 0)),
    infrastructure: { rail: 0, station: 0 },
  };
}

/** Port of company_cmd.cpp:CheckCompanyHasMoney (infinite_money is off). */
export const checkCompanyHasMoney = (c: CompanyState, cost: number): boolean =>
  cost <= 0 || cost <= c.money;

/** Port of company_cmd.cpp:SubtractMoneyFromAnyCompany (cur_economy arrives in block 1.5). */
export function subtractMoneyFromCompany(
  c: CompanyState,
  cost: number,
  expense: ExpensesType,
): void {
  if (cost === 0) return;
  c.money -= cost;
  const year = c.yearlyExpenses[0]!;
  year[expense] = year[expense]! + cost;
}

/** Port of company_cmd.cpp:UpdateLandscapingLimit. */
export function updateLandscapingLimit(c: CompanyState): void {
  c.clearLimit = Math.min(c.clearLimit + CLEAR_PER_64K_FRAMES, CLEAR_FRAME_BURST << 16) >>> 0;
}
