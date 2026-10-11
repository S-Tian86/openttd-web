// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GAME_OPTIONS, type GameOptions } from '../sim/game';
import { App } from './App';
import type { GameSpeed, Locale, Tool, UiSession, UiSnapshot } from './session';

const failed: UiSnapshot = {
  year: 1950,
  month: 0,
  day: 1,
  money: 100000,
  paused: false,
  speed: 'normal',
  locale: 'en',
  themeId: 'blocks',
  themes: [{ id: 'blocks', name: 'Blocks' }],
  generating: null,
  generationError: 'error.noTownCreated',
  gameOptions: DEFAULT_GAME_OPTIONS,
  tool: null,
  window: null,
};

const fakeSession = (snapshot: UiSnapshot): UiSession => ({
  getSnapshot: () => snapshot,
  subscribe: () => () => undefined,
  togglePause: vi.fn<() => void>(),
  setSpeed: vi.fn<(speed: GameSpeed) => void>(),
  setLocale: vi.fn<(locale: Locale) => void>(),
  setTheme: vi.fn<(id: string) => void>(),
  newGame: vi.fn<(options: GameOptions) => void>(),
  setTool: vi.fn<(tool: Tool | null) => void>(),
  openTown: vi.fn<(index: number) => void>(),
  closeWindow: vi.fn<() => void>(),
});

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
    const session = fakeSession({
      ...failed,
      generationError: null,
      window: { kind: 'town', info: TOWN },
    });
    render(<App session={session} />);
    const dialog = screen.getByRole('dialog', { name: 'Invenville (City)' });
    expect(dialog.textContent).toContain('Population: 412');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(session.closeWindow).toHaveBeenCalled();
  });

  it('closes the query window when Settings opens', () => {
    const session = fakeSession({
      ...failed,
      generationError: null,
      window: { kind: 'town', info: TOWN },
    });
    render(<App session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(session.closeWindow).toHaveBeenCalled();
  });

  it('toggles the query tool', () => {
    const session = fakeSession({ ...failed, generationError: null });
    render(<App session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Query tile' }));
    expect(session.setTool).toHaveBeenCalledWith('query');
  });
});
