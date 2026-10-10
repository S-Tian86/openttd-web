// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GAME_OPTIONS, type GameOptions } from '../sim/game';
import type { GameSpeed, Locale, UiSession, UiSnapshot } from './session';
import { StatusBar } from './StatusBar';

const snapshot: UiSnapshot = {
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
  generationError: null,
  gameOptions: DEFAULT_GAME_OPTIONS,
};

function fakeSession(s: UiSnapshot): UiSession {
  return {
    getSnapshot: () => s,
    subscribe: () => () => undefined,
    togglePause: vi.fn<() => void>(),
    setSpeed: vi.fn<(speed: GameSpeed) => void>(),
    setLocale: vi.fn<(locale: Locale) => void>(),
    setTheme: vi.fn<(id: string) => void>(),
    newGame: vi.fn<(options: GameOptions) => void>(),
  };
}

afterEach(cleanup);

describe('StatusBar', () => {
  it('shows date and money in the current language', () => {
    render(
      <StatusBar
        session={fakeSession(snapshot)}
        snapshot={snapshot}
        onNewGame={() => undefined}
        onSettings={() => undefined}
      />,
    );
    expect(screen.getByText('£100,000')).toBeTruthy();
    expect(screen.getByText(/1950/)).toBeTruthy();
  });

  it('names the group of speed buttons', () => {
    render(
      <StatusBar
        session={fakeSession(snapshot)}
        snapshot={snapshot}
        onNewGame={() => undefined}
        onSettings={() => undefined}
      />,
    );
    expect(screen.getByRole('group', { name: 'Game speed' })).toBeTruthy();
  });

  it('pauses and changes speed through the session', () => {
    const session = fakeSession(snapshot);
    render(
      <StatusBar
        session={session}
        snapshot={snapshot}
        onNewGame={() => undefined}
        onSettings={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fast forward' }));
    expect(session.togglePause).toHaveBeenCalled();
    expect(session.setSpeed).toHaveBeenCalledWith('fast');
  });
});
