// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuildBar } from './BuildBar';
import { ErrorMessage, ERROR_MESSAGE_MS } from './ErrorMessage';
import { errorText } from './errors';
import { BASE_SNAPSHOT, fakeSession } from './testing';
import { Toolbar } from './Toolbar';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('construction toolbar', () => {
  it('toggles tools and shows each tool its options', () => {
    const session = fakeSession();
    const { rerender } = render(
      <Toolbar session={session} snapshot={BASE_SNAPSHOT} onFinances={() => undefined} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Build railway track' }));
    expect(session.setTool).toHaveBeenCalledWith('rail');
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    rerender(
      <Toolbar
        session={session}
        snapshot={{ ...BASE_SNAPSHOT, tool: 'station' }}
        onFinances={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(session.setRemoveMode).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Platforms along Y' }));
    expect(session.setStationAxis).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'Build railway station' }));
    expect(session.setTool).toHaveBeenLastCalledWith(null);
    rerender(
      <Toolbar
        session={session}
        snapshot={{ ...BASE_SNAPSHOT, tool: 'depot' }}
        onFinances={() => undefined}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Exit north-west' }).getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Exit north-east' }));
    expect(session.setDepotDir).toHaveBeenCalledWith(0);
  });

  it('hides the station orientation while removing', () => {
    render(
      <Toolbar
        session={fakeSession()}
        snapshot={{ ...BASE_SNAPSHOT, tool: 'station', removeMode: true }}
        onFinances={() => undefined}
      />,
    );
    expect(screen.queryByRole('group', { name: 'Orientation' })).toBeNull();
  });
});

describe('cost bar', () => {
  it('shows the estimate, or the income of a removal', () => {
    const preview = { ok: true, cost: 450, error: null, needsConfirm: false };
    const { rerender } = render(
      <BuildBar session={fakeSession()} snapshot={{ ...BASE_SNAPSHOT, preview }} />,
    );
    expect(screen.getByRole('status').textContent).toContain('Estimated Cost: £450');
    expect(screen.queryByRole('button', { name: 'Build' })).toBeNull();
    rerender(
      <BuildBar
        session={fakeSession()}
        snapshot={{ ...BASE_SNAPSHOT, preview: { ...preview, cost: -265 } }}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('Estimated Income: £265');
  });

  it('shows no cost for a refusal without a message (CMD_ERROR, R31)', () => {
    const preview = { ok: false, cost: 0, error: null, needsConfirm: false };
    render(<BuildBar session={fakeSession()} snapshot={{ ...BASE_SNAPSHOT, preview }} />);
    const bar = screen.getByRole('status');
    expect([bar.className, bar.textContent]).toEqual(['build-bar bad', '']);
  });

  it('keeps the estimate of a demolition the cash cannot cover (R22, R31)', () => {
    const preview = { ok: false, cost: 300, error: null, needsConfirm: false };
    render(<BuildBar session={fakeSession()} snapshot={{ ...BASE_SNAPSHOT, preview }} />);
    expect(screen.getByRole('status').textContent).toBe('Estimated Cost: £300');
  });

  it('asks a touch user to confirm, and shows a failing reason in Spanish', () => {
    const session = fakeSession();
    const preview = {
      ok: false,
      cost: 0,
      error: { key: 'error.notEnoughCash' as const, money: 450, industry: null, town: null },
      needsConfirm: true,
    };
    render(<BuildBar session={session} snapshot={{ ...BASE_SNAPSHOT, locale: 'es', preview }} />);
    expect(screen.getByRole('status').textContent).toMatch(
      /No hay suficiente dinero - se necesita 450\s£/,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Construir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(session.confirmBuild).toHaveBeenCalledOnce();
    expect(session.cancelBuild).toHaveBeenCalledOnce();
  });
});

describe('error message (error_gui.cpp)', () => {
  it('shows header and detail and closes after 5 seconds or a click', () => {
    vi.useFakeTimers();
    const session = fakeSession();
    const error = {
      header: 'header.cantBuildRail' as const,
      detail: {
        key: 'error.notAllowedWhilePaused' as const,
        money: null,
        industry: null,
        town: null,
      },
    };
    render(<ErrorMessage session={session} snapshot={{ ...BASE_SNAPSHOT, error }} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain("Can't build railway track here...");
    expect(alert.textContent).toContain('Not allowed while paused');
    vi.advanceTimersByTime(ERROR_MESSAGE_MS);
    fireEvent.click(alert);
    expect(session.dismissError).toHaveBeenCalledTimes(2);
  });

  it('names the industry type and the town in the way', () => {
    const industry = { index: 0, type: 'coalMine' as const, townName: 'Invenville', x: 1, y: 2 };
    expect([
      errorText('en', { key: 'error.objectInTheWay', money: null, industry, town: null }),
      errorText('es', { key: 'error.objectInTheWay', money: null, industry, town: null }),
      errorText('en', {
        key: 'error.localAuthorityRefuses',
        money: null,
        industry: null,
        town: 'Invenville',
      }),
    ]).toEqual([
      'Coal Mine in the way',
      'Mina de carbón en medio',
      'Invenville local authority refuses to allow this',
    ]);
  });
});
