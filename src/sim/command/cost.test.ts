import { describe, expect, it } from 'vitest';
import { addCost, fail, succeed } from './cost';

describe('addCost (port of command.cpp:CommandCost::AddCost)', () => {
  it('sums two successes and keeps the total expense type', () => {
    expect(addCost(succeed(450), succeed(-53))).toEqual(succeed(397));
  });

  it('turns into the failure of the part', () => {
    expect(addCost(succeed(450), fail('error.notEnoughCash', { money: 5 }))).toEqual(
      fail('error.notEnoughCash', { money: 5 }),
    );
  });

  it('keeps the first error when a later one fails too', () => {
    const first = fail('error.maximumPermittedLoan', { money: 1 });
    expect(addCost(first, fail('error.notEnoughCash', { money: 2 }))).toEqual(first);
    expect(addCost(first, succeed(10))).toEqual(first);
  });
});
