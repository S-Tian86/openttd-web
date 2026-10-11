// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Stepper } from './Stepper';

afterEach(cleanup);

const VALUES = [0, 50, 100];
const format = (v: number) => (v === 0 ? 'Right click' : `Hover for ${v} ms`);

function renderStepper(value: number, onChange = vi.fn<(v: number) => void>()) {
  render(
    <Stepper
      label="Show tooltips"
      value={value}
      values={VALUES}
      format={format}
      decreaseLabel="Decrease"
      increaseLabel="Increase"
      onChange={onChange}
    />,
  );
  return onChange;
}

describe('Stepper (settings_gui.cpp arrows of a numeric setting)', () => {
  it('shows the label and the formatted value', () => {
    renderStepper(50);
    expect(screen.getByRole('group', { name: 'Show tooltips' }).textContent).toContain(
      'Hover for 50 ms',
    );
  });

  it('steps to the previous and next allowed value', () => {
    const onChange = renderStepper(50);
    fireEvent.click(screen.getByRole('button', { name: 'Decrease' }));
    expect(onChange).toHaveBeenLastCalledWith(0);
    fireEvent.click(screen.getByRole('button', { name: 'Increase' }));
    expect(onChange).toHaveBeenLastCalledWith(100);
  });

  it('cannot step past either end', () => {
    renderStepper(0);
    expect(screen.getByRole('button', { name: 'Decrease' }).hasAttribute('disabled')).toBe(true);
    cleanup();
    renderStepper(100);
    expect(screen.getByRole('button', { name: 'Increase' }).hasAttribute('disabled')).toBe(true);
  });
});
