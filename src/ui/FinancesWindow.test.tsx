// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FinancesWindow, LOAN_LONG_PRESS_MS } from './FinancesWindow';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('finances window (company_gui.cpp)', () => {
  it('shows cash, loan and limit, and borrows one step or as much as possible', () => {
    const onLoan = vi.fn<(action: 'borrow' | 'repay', all: boolean) => void>();
    render(
      <FinancesWindow locale="en" money={100000} loan={100000} maxLoan={300000} onLoan={onLoan} />,
    );
    for (const text of ['Bank Balance: £100,000', 'Loan: £100,000', 'Maximum Loan: £300,000'])
      expect(screen.getByText(text)).toBeTruthy();
    const borrow = screen.getByRole('button', { name: 'Borrow £10,000' });
    fireEvent.click(borrow);
    fireEvent.click(borrow, { ctrlKey: true });
    expect(onLoan.mock.calls).toEqual([
      ['borrow', false],
      ['borrow', true],
    ]);
  });

  it('repays everything on a long press, without a second step from the click that follows', () => {
    vi.useFakeTimers();
    const onLoan = vi.fn<(action: 'borrow' | 'repay', all: boolean) => void>();
    render(
      <FinancesWindow locale="es" money={100000} loan={100000} maxLoan={300000} onLoan={onLoan} />,
    );
    const repay = screen.getByRole('button', { name: /Pagar Préstamo 10\.000\s£/ });
    fireEvent.pointerDown(repay);
    vi.advanceTimersByTime(LOAN_LONG_PRESS_MS);
    fireEvent.pointerUp(repay);
    fireEvent.click(repay);
    expect(onLoan.mock.calls).toEqual([['repay', true]]);
  });

  it('lets the next press decide for itself when a long press ended without a click', () => {
    vi.useFakeTimers();
    const onLoan = vi.fn<(action: 'borrow' | 'repay', all: boolean) => void>();
    render(
      <FinancesWindow locale="en" money={100000} loan={100000} maxLoan={300000} onLoan={onLoan} />,
    );
    const repay = screen.getByRole('button', { name: 'Repay £10,000' });
    fireEvent.pointerDown(repay);
    vi.advanceTimersByTime(LOAN_LONG_PRESS_MS);
    fireEvent.pointerLeave(repay); // released off the button: no click follows
    fireEvent.pointerDown(repay);
    fireEvent.pointerUp(repay);
    fireEvent.click(repay);
    expect(onLoan.mock.calls).toEqual([
      ['repay', true],
      ['repay', false],
    ]);
  });

  it('does not fire a pending long press once the window is closed', () => {
    vi.useFakeTimers();
    const onLoan = vi.fn<(action: 'borrow' | 'repay', all: boolean) => void>();
    const { unmount } = render(
      <FinancesWindow locale="en" money={100000} loan={100000} maxLoan={300000} onLoan={onLoan} />,
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Repay £10,000' }));
    unmount();
    vi.advanceTimersByTime(LOAN_LONG_PRESS_MS);
    expect(onLoan).not.toHaveBeenCalled();
  });
});
