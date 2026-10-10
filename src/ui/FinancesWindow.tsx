import { useEffect, useRef } from 'preact/hooks';
import { LOAN_INTERVAL } from '../sim/economy/company';
import { formatMoney, translate } from './i18n/i18n';
import type { Locale } from './session';

/** A press this long on a loan button means "as much as possible", as Ctrl+click does (R25). */
export const LOAN_LONG_PRESS_MS = 500;

type LoanAction = 'borrow' | 'repay';

interface FinancesWindowProps {
  locale: Locale;
  money: number;
  loan: number;
  maxLoan: number;
  onLoan(action: LoanAction, all: boolean): void;
}

/** Port of company_gui.cpp's finances window, loan part: the yearly table is block 1.5. */
export function FinancesWindow({ locale, money, loan, maxLoan, onLoan }: FinancesWindowProps) {
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const step = formatMoney(locale, LOAN_INTERVAL);
  const stopTimer = (): void => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stopTimer, []); // closing the window mid-press must not borrow or repay
  const button = (action: LoanAction, label: 'finances.borrow' | 'finances.repay') => (
    <button
      type="button"
      class="loan-button"
      onPointerDown={() => {
        stopTimer();
        longPressed.current = false; // each press decides its own long press
        timer.current = window.setTimeout(() => {
          timer.current = null;
          longPressed.current = true;
          onLoan(action, true);
        }, LOAN_LONG_PRESS_MS);
      }}
      onPointerUp={stopTimer}
      onPointerLeave={stopTimer}
      onPointerCancel={stopTimer}
      onClick={(e) => {
        if (longPressed.current) {
          longPressed.current = false; // the click that ends a long press is not a second step
          return;
        }
        onLoan(action, e.ctrlKey);
      }}
    >
      {translate(locale, label, { money: step })}
    </button>
  );
  return (
    <div class="finances-window">
      <p>{translate(locale, 'finances.balance', { money: formatMoney(locale, money) })}</p>
      <p>{translate(locale, 'finances.loan', { money: formatMoney(locale, loan) })}</p>
      <p>{translate(locale, 'finances.maxLoan', { money: formatMoney(locale, maxLoan) })}</p>
      <div class="finances-actions">
        {button('borrow', 'finances.borrow')}
        {button('repay', 'finances.repay')}
      </div>
      <p class="finances-hint">{translate(locale, 'finances.hint')}</p>
    </div>
  );
}
