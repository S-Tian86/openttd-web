import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { createEmptyGame, hashGameState, type GameState } from '../game';
import {
  checkCompanyHasMoney,
  ExpensesType,
  subtractMoneyFromCompany,
  updateLandscapingLimit,
} from './company';

const newGame = (): GameState => createEmptyGame({ mapLogX: 6, mapLogY: 6 });
const zeros = (): number[] => Array.from({ length: 13 }, () => 0);

describe('company money (port of company_cmd.cpp)', () => {
  it('starts with £100,000 cash and loan, a £300,000 limit and a full clearing allowance', () => {
    expect(newGame().company).toEqual({
      money: 100000,
      currentLoan: 100000,
      maxLoan: 300000,
      clearLimit: 4096 * 65536,
      yearlyExpenses: [zeros(), zeros(), zeros()],
      infrastructure: { rail: 0, station: 0 },
    });
  });

  it('allows spending exactly the cash and never more (CheckCompanyHasMoney, Review Focus 2)', () => {
    const { company } = newGame();
    company.money = 270;
    expect([270, 271, -53, 0].map((cost) => checkCompanyHasMoney(company, cost))).toEqual([
      true,
      false,
      true,
      true,
    ]);
    company.money = -10;
    expect([0, -5, 1].map((cost) => checkCompanyHasMoney(company, cost))).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('books every charge by expense type (SubtractMoneyFromAnyCompany)', () => {
    const { company } = newGame();
    subtractMoneyFromCompany(company, 450, ExpensesType.Construction);
    subtractMoneyFromCompany(company, -53, ExpensesType.Construction);
    subtractMoneyFromCompany(company, 0, ExpensesType.Other);
    expect(company.money).toBe(99603);
    expect(company.yearlyExpenses[0]![ExpensesType.Construction]).toBe(397);
    expect(company.yearlyExpenses[0]![ExpensesType.Other]).toBe(0);
  });

  it('regains 64 tiles of clearing per tick, up to 4096 (UpdateLandscapingLimit)', () => {
    const { company } = newGame();
    company.clearLimit = 10 << 16;
    updateLandscapingLimit(company);
    expect(company.clearLimit).toBe(74 << 16);
    company.clearLimit = 4090 << 16;
    updateLandscapingLimit(company);
    expect(company.clearLimit).toBe(4096 * 65536);
  });
});

describe('loans (port of misc_cmd.cpp)', () => {
  it('borrows £10,000 a click, or up to the limit (CmdIncreaseLoan)', () => {
    const game = newGame();
    expect(execute(game, { type: 'increaseLoan', amount: 'interval' }, 'exec')).toEqual({
      ok: true,
      cost: 0,
    });
    expect([game.company.money, game.company.currentLoan]).toEqual([110000, 110000]);
    execute(game, { type: 'increaseLoan', amount: 'max' }, 'exec');
    expect([game.company.money, game.company.currentLoan]).toEqual([300000, 300000]);
    expect(execute(game, { type: 'increaseLoan', amount: 'interval' }, 'exec')).toEqual({
      ok: false,
      error: { key: 'error.maximumPermittedLoan', params: { money: 300000 } },
    });
    expect(game.company.yearlyExpenses[0]![ExpensesType.Other]).toBe(0); // a loan is not an expense
  });

  it('repays £10,000 a click, or all the cash allows (CmdDecreaseLoan, Review Focus 2)', () => {
    const game = newGame();
    execute(game, { type: 'decreaseLoan', amount: 'interval' }, 'exec');
    expect([game.company.money, game.company.currentLoan]).toEqual([90000, 90000]);
    game.company.money = 95500;
    game.company.currentLoan = 100000;
    execute(game, { type: 'decreaseLoan', amount: 'max' }, 'exec');
    expect([game.company.money, game.company.currentLoan]).toEqual([5500, 10000]);
    game.company.money = 5000;
    expect(execute(game, { type: 'decreaseLoan', amount: 'max' }, 'exec')).toEqual({
      ok: false,
      error: { key: 'error.currencyRequired', params: { money: 10000 } },
    });
    game.company.currentLoan = 0;
    expect(execute(game, { type: 'decreaseLoan', amount: 'interval' }, 'exec')).toEqual({
      ok: false,
      error: { key: 'error.loanAlreadyRepaid', params: {} },
    });
  });

  it('refuses loans while paused and changes nothing in test mode (R24)', () => {
    const game = newGame();
    const untouched = hashGameState(game);
    expect(execute(game, { type: 'increaseLoan', amount: 'interval' }, 'test')).toEqual({
      ok: true,
      cost: 0,
    });
    expect(game.company.currentLoan).toBe(100000);
    expect(hashGameState(game)).toBe(untouched); // test mode changes nothing
    game.paused = true;
    const before = hashGameState(game);
    expect(execute(game, { type: 'increaseLoan', amount: 'interval' }, 'exec')).toEqual({
      ok: false,
      error: { key: 'error.notAllowedWhilePaused', params: {} },
    });
    expect(hashGameState(game)).toBe(before);
  });
});
