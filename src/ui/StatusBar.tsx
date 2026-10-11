import { formatDate, formatMoney, translate, type MessageKey } from './i18n/i18n';
import { IconButton } from './IconButton';
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
  onNewGame: () => void;
  onSettings: () => void;
}

export function StatusBar({ session, snapshot, onNewGame, onSettings }: StatusBarProps) {
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
        <IconButton
          label={snapshot.paused ? t('hud.resume') : t('hud.pause')}
          pressed={snapshot.paused}
          onClick={() => session.togglePause()}
        >
          {snapshot.paused ? '▶' : '⏸'}
        </IconButton>
        <div class="speed-group" role="group" aria-label={t('hud.speed')}>
          {SPEEDS.map(({ speed, label, glyph }) => (
            <IconButton
              key={speed}
              label={t(label)}
              pressed={snapshot.speed === speed}
              onClick={() => session.setSpeed(speed)}
            >
              {glyph}
            </IconButton>
          ))}
        </div>
        <IconButton
          label={t('tool.query')}
          pressed={snapshot.tool === 'query'}
          onClick={() => session.setTool(snapshot.tool === 'query' ? null : 'query')}
        >
          ?
        </IconButton>
        <IconButton label={t('hud.newGame')} onClick={onNewGame}>
          ＋
        </IconButton>
        <IconButton label={t('hud.settings')} onClick={onSettings}>
          ⚙
        </IconButton>
      </div>
    </header>
  );
}
