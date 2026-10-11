import { DEFAULT_MAP_CONTROLS, type MapControls } from '../render/controls';
import { SCROLL_MODES, WHEEL_MODES, WHEEL_SPEEDS } from '../ui/session';

export const CONTROLS_STORAGE_KEY = 'openttd-web.controls';

const pick = <T>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/** The saved map controls; each missing or invalid field falls back to OpenTTD's default. */
export function loadControls(storage: Pick<Storage, 'getItem'> | undefined): MapControls {
  let saved: unknown;
  try {
    saved = JSON.parse(storage?.getItem(CONTROLS_STORAGE_KEY) ?? 'null');
  } catch {
    // Blocked storage or a damaged value: OpenTTD's defaults.
  }
  if (typeof saved !== 'object' || saved === null) return DEFAULT_MAP_CONTROLS;
  const fields = saved as Record<string, unknown>;
  return {
    scrollMode: pick(SCROLL_MODES, fields['scrollMode'], DEFAULT_MAP_CONTROLS.scrollMode),
    wheel: pick(WHEEL_MODES, fields['wheel'], DEFAULT_MAP_CONTROLS.wheel),
    wheelSpeed: pick(WHEEL_SPEEDS, fields['wheelSpeed'], DEFAULT_MAP_CONTROLS.wheelSpeed),
  };
}

export function saveControls(
  storage: Pick<Storage, 'setItem'> | undefined,
  controls: MapControls,
): void {
  try {
    storage?.setItem(CONTROLS_STORAGE_KEY, JSON.stringify(controls));
  } catch {
    // Not persisted; the choice still applies to this session.
  }
}
