import { formatDate, formatMoney, translate, type MessageKey } from './i18n/i18n';
import type { GameSpeed, UiSession, UiSnapshot } from './session';

const SPEEDS: readonly { speed: GameSpeed; label: MessageKey; glyph: string }[] = [
  { speed: 'normal', label: 'hud.speed.normal', glyph: '1x' },
  { speed: 'x2', label: 'hud.speed.x2', glyph: '2x' },
  { speed: 'x4', label: 'hud.speed.x4', glyph: '4x' },
  { speed: 'fast', label: 'hud.speed.fast', glyph: '»' },
];

interface StatusBarProps {
  session: UiSession;
  snapshot: UiSnapshot;
  onSettings: () => void;
}

export function StatusBar({ session, snapshot, onSettings }: StatusBarProps) {
  const t = (key: MessageKey): string => translate(snapshot.locale, key);
  return (
    <header class="status-bar">
      <span class="status-date" aria-label={t('hud.date')}>
        {formatDate(snapshot.locale, snapshot.year, snapshot.month, snapshot.day)}
      </span>
      <span class="status-money" aria-label={t('hud.money')}>
        {formatMoney(snapshot.locale, snapshot.money)}
      </span>
      <div class="status-controls">
        <button
          type="button"
          aria-pressed={snapshot.paused}
          aria-label={snapshot.paused ? t('hud.resume') : t('hud.pause')}
          onClick={() => session.togglePause()}
        >
          {snapshot.paused ? '▶' : '⏸'}
        </button>
        <div class="speed-group" role="group" aria-label={t('hud.speed')}>
          {SPEEDS.map(({ speed, label, glyph }) => (
            <button
              key={speed}
              type="button"
              aria-pressed={snapshot.speed === speed}
              aria-label={t(label)}
              onClick={() => session.setSpeed(speed)}
            >
              {glyph}
            </button>
          ))}
        </div>
        <button type="button" aria-label={t('hud.settings')} onClick={onSettings}>
          ⚙
        </button>
      </div>
    </header>
  );
}
