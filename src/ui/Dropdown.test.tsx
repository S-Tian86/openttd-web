// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dropdown } from './Dropdown';

const OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
] as const;

function setup(value: string = 'en') {
  const onChange = vi.fn<(value: string) => void>();
  render(<Dropdown label="Language" value={value} options={OPTIONS} onChange={onChange} />);
  const label = OPTIONS.find((o) => o.value === value)?.label ?? '';
  const button = screen.getByRole('button', { name: `Language ${label}` });
  return { onChange, button };
}

afterEach(cleanup);

describe('Dropdown', () => {
  it('shows the current value and keeps the list closed', () => {
    const { button } = setup();
    expect(button.textContent).toContain('English');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('opens a list of every option with the current one selected', () => {
    const { button } = setup();
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['English', 'Español', 'Français']);
    expect(options.map((o) => o.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
  });

  it('chooses an option and closes', () => {
    const { button, onChange } = setup();
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('option', { name: 'Español' }));
    expect(onChange).toHaveBeenCalledWith('es');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes without a change when choosing the current value', () => {
    const { button, onChange } = setup();
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('option', { name: 'English' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes without a change on a click outside (dropdown.cpp OnFocusLost)', () => {
    const { button, onChange } = setup();
    fireEvent.click(button);
    const backdrop = document.querySelector('.dropdown-backdrop');
    if (backdrop === null) throw new Error('no backdrop');
    fireEvent.click(backdrop);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on Escape and gives the focus back to its button', () => {
    const { button } = setup();
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('moves with the arrow keys and chooses with Enter', () => {
    const { button, onChange } = setup('es');
    fireEvent.click(button);
    const list = screen.getByRole('listbox');
    expect(document.activeElement).toBe(list);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('en');
  });
});
