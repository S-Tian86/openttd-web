import { useEffect, useId, useRef, useState } from 'preact/hooks';

export interface DropdownOption<T> {
  value: T;
  label: string;
}

interface DropdownProps<T> {
  label: string;
  value: T;
  options: readonly DropdownOption<T>[];
  onChange: (value: T) => void;
}

/**
 * A dropdown drawn with the theme, in place of the browser's native select (master plan §2.7).
 * Like OpenTTD's (dropdown.cpp), a button shows the value and opens a list that closes on a
 * choice, on a click outside (OnFocusLost) or on Esc. Phones show the list as a centred sheet.
 */
export function Dropdown<T>({ label, value, options, onChange }: DropdownProps<T>) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const selected = Math.max(
    0,
    options.findIndex((option) => Object.is(option.value, value)),
  );

  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);

  const close = (): void => {
    setOpen(false);
    button.current?.focus();
  };

  const choose = (index: number): void => {
    const option = options[index];
    close();
    if (option !== undefined && !Object.is(option.value, value)) onChange(option.value);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(last, active + 1),
      ArrowUp: Math.max(0, active - 1),
      Home: 0,
      End: last,
    };
    const move = moves[event.key];
    if (move !== undefined) {
      setActive(move);
    } else if (event.key === 'Enter' || event.key === ' ') {
      choose(active);
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      close();
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div class="dropdown">
      <span id={`${id}-label`}>{label}</span>
      <button
        ref={button}
        id={`${id}-button`}
        type="button"
        class="dropdown-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-button`}
        onClick={() => {
          setActive(selected);
          setOpen(!open);
        }}
      >
        <span>{options[selected]?.label}</span>
        <span aria-hidden="true">▼</span>
      </button>
      {open ? (
        <>
          <div class="dropdown-backdrop" onClick={close} />
          <ul
            ref={list}
            role="listbox"
            tabIndex={-1}
            class="dropdown-list"
            aria-labelledby={`${id}-label`}
            aria-activedescendant={`${id}-${active}`}
            onKeyDown={onKeyDown}
          >
            {options.map((option, index) => (
              <li
                key={String(option.value)}
                id={`${id}-${index}`}
                role="option"
                aria-selected={index === selected}
                class={index === active ? 'active' : undefined}
                onClick={() => choose(index)}
              >
                {option.label}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
