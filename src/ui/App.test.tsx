// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GAME_OPTIONS, type GameOptions } from '../sim/game';
import { App } from './App.js';
import type { GameSpeed, Locale, UiSession, UiSnapshot } from './session';

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
};

const fakeSession = (snapshot: UiSnapshot): UiSession => ({
  getSnapshot: () => snapshot,
  subscribe: () => () => undefined,
  togglePause: vi.fn<() => void>(),
  setSpeed: vi.fn<(speed: GameSpeed) => void>(),
  setLocale: vi.fn<(locale: Locale) => void>(),
  setTheme: vi.fn<(id: string) => void>(),
  newGame: vi.fn<(options: GameOptions) => void>(),
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
