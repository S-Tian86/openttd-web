import { createContext, type ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

/** OpenTTD's gui.hover_delay_ms; 0 binds tooltips to the right mouse button. */
export const HoverDelay = createContext(250);

/** How long a tap on a touch screen shows the button's name (our addition: phones cannot hover). */
export const TOUCH_TOOLTIP_MS = 2000;

/** Gap between the button and its tooltip, in CSS pixels. */
const GAP_PX = 6;

interface IconButtonProps {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  class?: string;
  onClick: () => void;
  children: ComponentChildren;
}

/**
 * A button drawn as a glyph, named by a themed tooltip like OpenTTD's (misc_gui.cpp
 * GuiShowTooltips): after hovering for the delay, while the right button is held when the delay
 * is 0, or for a moment after a tap on touch. Native `title` tooltips are banned (§2.7).
 */
export function IconButton({
  label,
  pressed,
  disabled,
  class: className,
  onClick,
  children,
}: IconButtonProps) {
  const delay = useContext(HoverDelay);
  const [shown, setShown] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const button = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);

  const stopTimer = (): void => window.clearTimeout(timer.current);
  const hide = (): void => {
    stopTimer();
    setShown(false);
  };
  const showAfter = (ms: number): void => {
    stopTimer();
    timer.current = window.setTimeout(() => setShown(true), ms);
  };
  useEffect(() => stopTimer, []);

  // Above the button in the lower half of the screen, below it otherwise, kept on screen.
  useLayoutEffect(() => {
    if (!shown) {
      setPlace(null);
      return;
    }
    const at = button.current?.getBoundingClientRect();
    const size = tip.current?.getBoundingClientRect();
    if (at === undefined || size === undefined) return;
    const top =
      at.top > window.innerHeight / 2 ? at.top - size.height - GAP_PX : at.bottom + GAP_PX;
    const centred = at.left + at.width / 2 - size.width / 2;
    const left = Math.min(Math.max(centred, GAP_PX), window.innerWidth - size.width - GAP_PX);
    setPlace({ left, top });
  }, [shown]);

  return (
    <button
      ref={button}
      type="button"
      class={className}
      aria-pressed={pressed}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse' && delay > 0) showAfter(delay);
      }}
      onPointerLeave={(event) => {
        // A lifted finger also leaves; the tap's tooltip runs out on its own.
        if (event.pointerType === 'mouse') hide();
      }}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse' && event.button === 2 && delay === 0) {
          stopTimer();
          setShown(true);
        } else if (event.pointerType === 'mouse') {
          hide();
        }
      }}
      onPointerUp={(event) => {
        if (event.pointerType === 'touch') {
          stopTimer();
          setShown(true);
          timer.current = window.setTimeout(() => setShown(false), TOUCH_TOOLTIP_MS);
        } else if (event.button === 2 && delay === 0) {
          hide();
        }
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
      {shown
        ? createPortal(
            <span
              ref={tip}
              class="tooltip"
              aria-hidden="true"
              style={
                place === null
                  ? { visibility: 'hidden' }
                  : { left: `${place.left}px`, top: `${place.top}px` }
              }
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </button>
  );
}
