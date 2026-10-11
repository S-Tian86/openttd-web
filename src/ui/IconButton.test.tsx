// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HoverDelay, IconButton, TOUCH_TOOLTIP_MS } from './IconButton';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const tooltip = () => document.querySelector('.tooltip');

function renderButton(delay: number, onClick = vi.fn<() => void>()) {
  render(
    <HoverDelay.Provider value={delay}>
      <IconButton label="Build railway track" onClick={onClick}>
        ╪
      </IconButton>
    </HoverDelay.Provider>,
  );
  return { button: screen.getByRole('button', { name: 'Build railway track' }), onClick };
}

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('IconButton tooltips (misc_gui.cpp GuiShowTooltips)', () => {
  it('names the button after hovering for the delay, and hides when the mouse leaves', () => {
    const { button } = renderButton(250);
    fireEvent.pointerEnter(button, { pointerType: 'mouse' });
    advance(200);
    expect(tooltip()).toBeNull();
    advance(50);
    expect(tooltip()?.textContent).toBe('Build railway track');
    fireEvent.pointerLeave(button, { pointerType: 'mouse' });
    expect(tooltip()).toBeNull();
  });

  it('hides when the button is pressed (the mouse no longer hovers)', () => {
    const { button } = renderButton(250);
    fireEvent.pointerEnter(button, { pointerType: 'mouse' });
    advance(250);
    fireEvent.pointerDown(button, { pointerType: 'mouse', button: 0 });
    expect(tooltip()).toBeNull();
  });

  it('with the "Right click" setting, shows while the right button is held, not on hover', () => {
    const { button } = renderButton(0);
    fireEvent.pointerEnter(button, { pointerType: 'mouse' });
    advance(1000);
    expect(tooltip()).toBeNull();
    fireEvent.pointerDown(button, { pointerType: 'mouse', button: 2 });
    expect(tooltip()?.textContent).toBe('Build railway track');
    fireEvent.pointerUp(button, { pointerType: 'mouse', button: 2 });
    expect(tooltip()).toBeNull();
  });

  it('never opens the browser context menu on the button', () => {
    const { button } = renderButton(250);
    expect(fireEvent.contextMenu(button)).toBe(false); // default prevented
  });

  it('on touch, a tap acts and shows the name for a moment', () => {
    const { button, onClick } = renderButton(250);
    fireEvent.pointerEnter(button, { pointerType: 'touch' });
    fireEvent.pointerDown(button, { pointerType: 'touch', button: 0 });
    fireEvent.pointerUp(button, { pointerType: 'touch', button: 0 });
    // A lifted finger leaves the element right away (Pointer Events), the name stays.
    fireEvent.pointerLeave(button, { pointerType: 'touch' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
    expect(tooltip()?.textContent).toBe('Build railway track');
    advance(TOUCH_TOOLTIP_MS);
    expect(tooltip()).toBeNull();
  });
});
