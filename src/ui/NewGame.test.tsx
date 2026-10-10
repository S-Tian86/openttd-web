// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GAME_OPTIONS, type GameOptions } from '../sim/game';
import { NewGame, parseSeed } from './NewGame';
import type { GameSpeed, Locale, UiSession, UiSnapshot } from './session';

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
  gameOptions: { ...DEFAULT_GAME_OPTIONS, seed: 7 },
};

afterEach(cleanup);

const fakeSession = (): UiSession => ({
  getSnapshot: () => snapshot,
  subscribe: () => () => undefined,
  togglePause: vi.fn<() => void>(),
  setSpeed: vi.fn<(speed: GameSpeed) => void>(),
  setLocale: vi.fn<(locale: Locale) => void>(),
  setTheme: vi.fn<(id: string) => void>(),
  newGame: vi.fn<(options: GameOptions) => void>(),
});

describe('parseSeed (Review Focus 3)', () => {
  it('accepts uint32 integers only', () => {
    expect(
      ['0', '42', '4294967295', '', 'abc', '-1', '4294967296', '1.5', ' 7'].map(parseSeed),
    ).toEqual([0, 42, 4294967295, null, null, null, null, null, null]);
  });
});

describe('NewGame window', () => {
  it('starts from the current options and generates with the chosen ones', () => {
    const session = fakeSession();
    render(<NewGame session={session} snapshot={snapshot} onDone={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Map size X'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Map size Y'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Number of towns'), { target: { value: '1' } });
    fireEvent.input(screen.getByLabelText('Seed'), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(session.newGame).toHaveBeenCalledWith({
      ...DEFAULT_GAME_OPTIONS,
      mapLogX: 6,
      mapLogY: 7,
      townCount: 1,
      seed: 12345,
    });
  });

  it('disables Generate for a bad seed', () => {
    render(<NewGame session={fakeSession()} snapshot={snapshot} onDone={() => undefined} />);
    fireEvent.input(screen.getByLabelText('Seed'), { target: { value: 'abc' } });
    expect((screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('shows progress and generation errors', () => {
    const busy = { ...snapshot, generating: 0.42, generationError: 'error.noTownCreated' as const };
    render(<NewGame session={fakeSession()} snapshot={busy} onDone={() => undefined} />);
    expect(screen.getByRole('alert').textContent).toContain('Could not place any town');
  });

  it('never lets an invalid town level reach the generator (defaultTownCount indexes 0..3)', () => {
    const session = fakeSession();
    render(<NewGame session={session} snapshot={snapshot} onDone={() => undefined} />);
    const towns = screen.getByLabelText('Number of towns');
    for (const value of ['9', '-1', '1.5', 'abc', '']) {
      fireEvent.change(towns, { target: { value } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    }
    const levels = vi.mocked(session.newGame).mock.calls.map(([options]) => options.townCount);
    expect(levels.every((level) => [0, 1, 2, 3].includes(level))).toBe(true);
  });
});
