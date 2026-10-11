// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installKeyboard } from './keyboard';

const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  );
const release = (key: string, init: KeyboardEventInit = {}) =>
  document.body.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, ...init }));

let uninstall: () => void = () => undefined;
afterEach(() => {
  uninstall();
  document.body.replaceChildren();
});

const install = () => {
  const handlers = {
    onEscape: vi.fn<() => void>(),
    onDirKeys: vi.fn<(d: number, s: boolean) => void>(),
  };
  uninstall = installKeyboard(window, handlers);
  return handlers;
};

describe('keyboard: Esc (main_gui.cpp reset_object_to_place)', () => {
  it('drops the tool on Esc', () => {
    const { onEscape } = install();
    press('Escape');
    expect(onEscape).toHaveBeenCalledOnce();
  });

  it('leaves Esc to a control that already handled it, such as an open dropdown', () => {
    const { onEscape } = install();
    const list = document.createElement('ul');
    list.addEventListener('keydown', (event) => event.preventDefault());
    document.body.append(list);
    press('Escape', {}, list);
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('leaves Esc to a text field, as OpenTTD lets an edit box cancel first', () => {
    const { onEscape } = install();
    const input = document.createElement('input');
    document.body.append(input);
    press('Escape', {}, input);
    expect(onEscape).not.toHaveBeenCalled();
  });
});

describe('keyboard: arrow keys (gfx.cpp _dirkeys)', () => {
  it('reports the held arrows as dirkeys bits, left 1, up 2, right 4, down 8', () => {
    const { onDirKeys } = install();
    press('ArrowLeft');
    press('ArrowUp');
    expect(onDirKeys).toHaveBeenLastCalledWith(1 | 2, false);
    release('ArrowLeft');
    expect(onDirKeys).toHaveBeenLastCalledWith(2, false);
    press('ArrowRight');
    press('ArrowDown');
    release('ArrowUp');
    expect(onDirKeys).toHaveBeenLastCalledWith(4 | 8, false);
  });

  it('reports Shift for the fast scroll, also when it changes while an arrow is held', () => {
    const { onDirKeys } = install();
    press('ArrowLeft');
    press('Shift', { shiftKey: true });
    expect(onDirKeys).toHaveBeenLastCalledWith(1, true);
    release('Shift');
    expect(onDirKeys).toHaveBeenLastCalledWith(1, false);
  });

  it('keeps the page from scrolling with the arrows', () => {
    install();
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not scroll while a text field has focus (EditBoxInGlobalFocus)', () => {
    const { onDirKeys } = install();
    const input = document.createElement('input');
    document.body.append(input);
    press('ArrowLeft', {}, input);
    expect(onDirKeys).not.toHaveBeenCalled();
  });

  it('lets go of every arrow when the page loses focus, as the key-ups never arrive', () => {
    const { onDirKeys } = install();
    press('ArrowLeft');
    window.dispatchEvent(new Event('blur'));
    expect(onDirKeys).toHaveBeenLastCalledWith(0, false);
  });
});
