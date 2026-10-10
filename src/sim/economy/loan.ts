import { DoFlag, fail, succeed, type CommandCost } from '../command/cost';
import type { GameState } from '../game';
import { ExpensesType, LOAN_INTERVAL } from './company';

export type LoanAmount = 'interval' | 'max';

/** Port of misc_cmd.cpp:CmdIncreaseLoan. */
export function cmdIncreaseLoan(state: GameState, flags: number, amount: LoanAmount): CommandCost {
  const c = state.company;
  if (c.currentLoan >= c.maxLoan) return fail('error.maximumPermittedLoan', { money: c.maxLoan });
  const loan = amount === 'interval' ? LOAN_INTERVAL : c.maxLoan - c.currentLoan;
  if ((flags & DoFlag.Execute) !== 0) {
    c.money += loan;
    c.currentLoan += loan;
  }
  return succeed(0, ExpensesType.Other);
}

/** Port of misc_cmd.cpp:CmdDecreaseLoan. */
export function cmdDecreaseLoan(state: GameState, flags: number, amount: LoanAmount): CommandCost {
  const c = state.company;
  if (c.currentLoan === 0) return fail('error.loanAlreadyRepaid');
  let loan: number;
  if (amount === 'interval') {
    loan = Math.min(c.currentLoan, LOAN_INTERVAL);
  } else {
    loan = Math.max(Math.min(c.currentLoan, c.money), LOAN_INTERVAL);
    loan -= loan % LOAN_INTERVAL;
  }
  if (c.money < loan) return fail('error.currencyRequired', { money: loan });
  if ((flags & DoFlag.Execute) !== 0) {
    c.money -= loan;
    c.currentLoan -= loan;
  }
  return succeed(0, ExpensesType.Other);
}
