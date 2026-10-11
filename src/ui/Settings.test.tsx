// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { Settings } from './Settings';
import { BASE_SNAPSHOT, fakeSession } from './testing';

afterEach(cleanup);

function choose(label: string, option: string): void {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label} `) }));
  fireEvent.click(screen.getByRole('option', { name: option }));
}

describe('Settings: map controls (gui_settings.ini)', () => {
  it('shows the current controls with OpenTTD names', () => {
    render(<Settings session={fakeSession()} snapshot={BASE_SNAPSHOT} />);
    expect(
      screen.getByRole('button', { name: 'Viewport scroll behaviour Move map with RMB' }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Function of scrollwheel Zoom map' })).toBeDefined();
    expect(screen.getByRole('group', { name: 'Map scrollwheel speed' }).textContent).toContain('5');
    expect(screen.getByRole('group', { name: 'Show tooltips' }).textContent).toContain(
      'Hover for 250 milliseconds',
    );
  });

  it('changes one setting and keeps the others', () => {
    const session = fakeSession();
    render(<Settings session={session} snapshot={BASE_SNAPSHOT} />);
    choose('Viewport scroll behaviour', 'Move map with LMB');
    expect(session.setControls).toHaveBeenLastCalledWith({
      ...BASE_SNAPSHOT.controls,
      scrollMode: 'mapLmb',
    });
    choose('Function of scrollwheel', 'Scroll map');
    expect(session.setControls).toHaveBeenLastCalledWith({
      ...BASE_SNAPSHOT.controls,
      wheel: 'scroll',
    });
    const speed = screen.getByRole('group', { name: 'Map scrollwheel speed' });
    fireEvent.click(within(speed).getByRole('button', { name: 'Increase' }));
    expect(session.setControls).toHaveBeenLastCalledWith({
      ...BASE_SNAPSHOT.controls,
      wheelSpeed: 6,
    });
    const delay = screen.getByRole('group', { name: 'Show tooltips' });
    fireEvent.click(within(delay).getByRole('button', { name: 'Decrease' }));
    expect(session.setControls).toHaveBeenLastCalledWith({
      ...BASE_SNAPSHOT.controls,
      hoverDelay: 200,
    });
  });

  it('names the zero hover delay "Right click", as OpenTTD (GuiZeroIsSpecial)', () => {
    const snapshot = { ...BASE_SNAPSHOT, controls: { ...BASE_SNAPSHOT.controls, hoverDelay: 0 } };
    render(<Settings session={fakeSession()} snapshot={snapshot} />);
    expect(screen.getByRole('group', { name: 'Show tooltips' }).textContent).toContain(
      'Right click',
    );
  });

  it('offers the four scroll modes of OpenTTD', () => {
    render(<Settings session={fakeSession()} snapshot={BASE_SNAPSHOT} />);
    fireEvent.click(screen.getByRole('button', { name: /^Viewport scroll behaviour / }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Move viewport with RMB, mouse position locked',
      'Move map with RMB, mouse position locked',
      'Move map with RMB',
      'Move map with LMB',
    ]);
  });
});
