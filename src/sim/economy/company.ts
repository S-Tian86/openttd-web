/** Port of economy_type.h. */
export const LOAN_INTERVAL = 10000;
export const INITIAL_LOAN = 100000;
/** difficulty.max_loan default (difficulty_settings.ini), before inflation. */
export const DEFAULT_MAX_LOAN = 300000;
/** inflation_prices starts at 1.0 in 16.16 fixed point (economy.cpp:InitializeEconomy). */
const INFLATION_ONE = 1 << 16;

export interface CompanyState {
  money: number;
  currentLoan: number;
}

/** Port of company_cmd.cpp:DoStartupNewCompany (money part): cash = loan = initial loan. */
export function createCompany(maxLoan: number): CompanyState {
  const loan = Math.min(
    Math.floor(Math.floor((INITIAL_LOAN * INFLATION_ONE) / 65536) / LOAN_INTERVAL) * LOAN_INTERVAL,
    maxLoan,
  );
  return { money: loan, currentLoan: loan };
}
