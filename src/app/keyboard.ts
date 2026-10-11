/** gfx.cpp _dirkeys: the bit of each arrow key. */
const DIR_KEY_BITS: Readonly<Record<string, number>> = {
  ArrowLeft: 1,
  ArrowUp: 2,
  ArrowRight: 4,
  ArrowDown: 8,
};

export interface KeyboardHandlers {
  /** main_gui.cpp's global hotkey reset_object_to_place. */
  onEscape(): void;
  /** The held arrow keys as _dirkeys bits, and whether Shift is down. */
  onDirKeys(dirkeys: number, shift: boolean): void;
}

/** A focused edit box takes the keys first, as OpenTTD's EditBoxInGlobalFocus. */
const isTextField = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest('input, textarea, [contenteditable="true"]') !== null;

/** Listens for OpenTTD's global map keys on the page; returns a function that stops listening. */
export function installKeyboard(target: Window, handlers: KeyboardHandlers): () => void {
  let dirkeys = 0;
  let shift = false;
  const report = (nextKeys: number, nextShift: boolean): void => {
    if (nextKeys === dirkeys && nextShift === shift) return;
    dirkeys = nextKeys;
    shift = nextShift;
    handlers.onDirKeys(dirkeys, shift);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || isTextField(event.target)) return;
    if (event.key === 'Escape') {
      handlers.onEscape();
      return;
    }
    const bit = DIR_KEY_BITS[event.key];
    if (bit !== undefined) event.preventDefault(); // the page itself must not scroll
    report(dirkeys | (bit ?? 0), event.shiftKey);
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    report(dirkeys & ~(DIR_KEY_BITS[event.key] ?? 0), event.shiftKey);
  };
  // Key-ups are lost while another window has focus.
  const onBlur = (): void => report(0, false);

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);
  return () => {
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    target.removeEventListener('blur', onBlur);
  };
}
