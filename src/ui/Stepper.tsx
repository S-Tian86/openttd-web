import { useId } from 'preact/hooks';
import { IconButton } from './IconButton';

interface StepperProps {
  label: string;
  value: number;
  /** The allowed values in ascending order; the arrows step between neighbours. */
  values: readonly number[];
  format: (value: number) => string;
  decreaseLabel: string;
  increaseLabel: string;
  onChange: (value: number) => void;
}

/** A numeric setting with OpenTTD's left and right arrows (settings_gui.cpp), drawn with the theme. */
export function Stepper({
  label,
  value,
  values,
  format,
  decreaseLabel,
  increaseLabel,
  onChange,
}: StepperProps) {
  const id = useId();
  const index = values.indexOf(value);
  const step = (by: number): void => {
    const next = values[index + by];
    if (next !== undefined) onChange(next);
  };
  return (
    <div class="stepper" role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`}>{label}</span>
      <div class="stepper-controls">
        <IconButton label={decreaseLabel} disabled={index <= 0} onClick={() => step(-1)}>
          ◀
        </IconButton>
        <span class="stepper-value">{format(value)}</span>
        <IconButton
          label={increaseLabel}
          disabled={index < 0 || index >= values.length - 1}
          onClick={() => step(1)}
        >
          ▶
        </IconButton>
      </div>
    </div>
  );
}
