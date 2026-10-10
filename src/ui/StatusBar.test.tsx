// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { StatusBar } from './StatusBar';
import { BASE_SNAPSHOT as snapshot, fakeSession } from './testing';

afterEach(cleanup);

describe('StatusBar', () => {
  it('shows date and money in the current language', () => {
    render(
      <StatusBar
        session={fakeSession()}
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
        session={fakeSession()}
        snapshot={snapshot}
        onNewGame={() => undefined}
        onSettings={() => undefined}
      />,
    );
    expect(screen.getByRole('group', { name: 'Game speed' })).toBeTruthy();
  });

  it('pauses and changes speed through the session', () => {
    const session = fakeSession();
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
