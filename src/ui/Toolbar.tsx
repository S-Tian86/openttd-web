import { DiagDir } from '../sim/map/geometry';
import { Axis } from '../sim/track/track';
import { translate, type MessageKey } from './i18n/i18n';
import type { Tool, UiSession, UiSnapshot } from './session';

const TOOLS: readonly { tool: Tool; label: MessageKey; glyph: string }[] = [
  { tool: 'rail', label: 'tool.rail', glyph: '╪' },
  { tool: 'station', label: 'tool.station', glyph: '▤' },
  { tool: 'depot', label: 'tool.depot', glyph: '⌂' },
  { tool: 'demolish', label: 'tool.demolish', glyph: '✖' },
];

const AXES: readonly { axis: Axis; label: MessageKey; glyph: string }[] = [
  { axis: Axis.X, label: 'build.axisX', glyph: '↕' },
  { axis: Axis.Y, label: 'build.axisY', glyph: '↔' },
];

/** Depot exits as seen on the top-down map: NE is up, SE right, SW down, NW left. */
const DIRS: readonly { dir: DiagDir; label: MessageKey; glyph: string }[] = [
  { dir: DiagDir.NE, label: 'build.dir.ne', glyph: '↑' },
  { dir: DiagDir.SE, label: 'build.dir.se', glyph: '→' },
  { dir: DiagDir.SW, label: 'build.dir.sw', glyph: '↓' },
  { dir: DiagDir.NW, label: 'build.dir.nw', glyph: '←' },
];

/**
 * The construction tools (rail_gui.cpp's toolbar with the station and depot pickers folded in).
 * Tools stay on after building (gui.persistent_buildingtools); pressing the active one again
 * turns it off.
 */
export function Toolbar({
  session,
  snapshot,
  onFinances,
}: {
  session: UiSession;
  snapshot: UiSnapshot;
  onFinances: () => void;
}) {
  const t = (key: MessageKey): string => translate(snapshot.locale, key);
  const { tool, removeMode } = snapshot;
  return (
    <nav class="toolbar" aria-label={t('toolbar.label')}>
      {TOOLS.map(({ tool: id, label, glyph }) => (
        <button
          key={id}
          type="button"
          aria-pressed={tool === id}
          aria-label={t(label)}
          onClick={() => session.setTool(tool === id ? null : id)}
        >
          {glyph}
        </button>
      ))}
      {tool === 'rail' || tool === 'station' ? (
        <button
          type="button"
          class="toolbar-option"
          aria-pressed={removeMode}
          aria-label={t('tool.remove')}
          onClick={() => session.setRemoveMode(!removeMode)}
        >
          ⌫
        </button>
      ) : null}
      {tool === 'station' && !removeMode ? (
        <div class="toolbar-group" role="group" aria-label={t('build.orientation')}>
          {AXES.map(({ axis, label, glyph }) => (
            <button
              key={axis}
              type="button"
              aria-pressed={snapshot.stationAxis === axis}
              aria-label={t(label)}
              onClick={() => session.setStationAxis(axis)}
            >
              {glyph}
            </button>
          ))}
        </div>
      ) : null}
      {tool === 'depot' ? (
        <div class="toolbar-group" role="group" aria-label={t('build.orientation')}>
          {DIRS.map(({ dir, label, glyph }) => (
            <button
              key={dir}
              type="button"
              aria-pressed={snapshot.depotDir === dir}
              aria-label={t(label)}
              onClick={() => session.setDepotDir(dir)}
            >
              {glyph}
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        class="toolbar-option"
        aria-label={t('hud.finances')}
        onClick={onFinances}
      >
        £
      </button>
    </nav>
  );
}
