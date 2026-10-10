// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';
import type { UiSnapshot } from './session';
import { fakeSession } from './testing';

const failed: Partial<UiSnapshot> = { generationError: 'error.noTownCreated' };

afterEach(cleanup);

describe('App generation errors', () => {
  it('shows the error with the panel closed and opens the new-game window from it', () => {
    render(<App session={fakeSession(failed)} />);
    expect(screen.getByRole('alert').textContent).toContain('Could not place any town');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Change settings' }));
    expect(screen.getByRole('dialog', { name: 'New game' })).toBeTruthy();
  });

  it('does not repeat the alert while the window is open', () => {
    render(<App session={fakeSession(failed)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change settings' }));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});

const TOWN = {
  index: 0,
  name: 'Invenville',
  isCity: true,
  population: 412,
  houses: 17,
  x: 20,
  y: 30,
};

describe('App query windows', () => {
  it('shows a city window with its title and closes it through the session', () => {
    const session = fakeSession({ window: { kind: 'town', info: TOWN } });
    render(<App session={session} />);
    const dialog = screen.getByRole('dialog', { name: 'Invenville (City)' });
    expect(dialog.textContent).toContain('Population: 412');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(session.closeWindow).toHaveBeenCalled();
  });

  it('closes the query window when Settings opens', () => {
    const session = fakeSession({ window: { kind: 'town', info: TOWN } });
    render(<App session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(session.closeWindow).toHaveBeenCalled();
  });

  it('toggles the query tool', () => {
    const session = fakeSession();
    render(<App session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Query tile' }));
    expect(session.setTool).toHaveBeenCalledWith('query');
  });
});
