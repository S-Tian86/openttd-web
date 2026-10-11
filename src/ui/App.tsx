import { useEffect, useState } from 'preact/hooks';
import { BuildBar } from './BuildBar';
import { ErrorMessage } from './ErrorMessage';
import { FinancesWindow } from './FinancesWindow';
import { HoverDelay } from './IconButton';
import { translate } from './i18n/i18n';
import { IndustryWindow, industryName } from './IndustryWindow';
import { NewGame } from './NewGame';
import { Panel } from './Panel';
import type { UiSession, UiWindow } from './session';
import { Settings } from './Settings';
import { StatusBar } from './StatusBar';
import { TileInfo } from './TileInfo';
import { Toolbar } from './Toolbar';
import { TownWindow } from './TownWindow';
import { useSnapshot } from './useSnapshot';

type PanelId = 'settings' | 'newGame' | 'finances';

/** Identity of the open window, so a refresh of the same window does not count as a new one. */
function windowKey(window: UiWindow | null): string | null {
  if (window === null) return null;
  return window.kind === 'tile'
    ? `tile:${window.info.tile}`
    : `${window.kind}:${window.info.index}`;
}

export function App({ session }: { session: UiSession }) {
  const snapshot = useSnapshot(session);
  const [open, setOpen] = useState<PanelId | null>(null);
  const toggle = (id: PanelId): void => {
    session.closeWindow(); // one window at a time
    setOpen((current) => (current === id ? null : id));
  };
  const openKey = windowKey(snapshot.window);
  useEffect(() => {
    if (openKey !== null) setOpen(null); // a new query replaces Settings or New game
  }, [openKey]);
  const t = (key: Parameters<typeof translate>[1]): string => translate(snapshot.locale, key);
  const queryWindow = snapshot.window;
  const windowTitle = (w: UiWindow): string => {
    if (w.kind === 'tile') return t('tile.title');
    if (w.kind === 'industry') return industryName(snapshot.locale, w.info);
    return w.info.isCity
      ? translate(snapshot.locale, 'town.city', { name: w.info.name })
      : w.info.name;
  };
  return (
    <HoverDelay.Provider value={snapshot.controls.hoverDelay}>
      <div class="hud">
        <StatusBar
          session={session}
          snapshot={snapshot}
          onNewGame={() => toggle('newGame')}
          onSettings={() => toggle('settings')}
        />
        <Toolbar session={session} snapshot={snapshot} onFinances={() => toggle('finances')} />
        <BuildBar session={session} snapshot={snapshot} />
      </div>
      <ErrorMessage session={session} snapshot={snapshot} />
      {open === 'settings' ? (
        <Panel
          title={t('settings.title')}
          closeLabel={t('panel.close')}
          onClose={() => setOpen(null)}
        >
          <Settings session={session} snapshot={snapshot} />
        </Panel>
      ) : null}
      {open === 'newGame' ? (
        <Panel
          title={t('newGame.title')}
          closeLabel={t('panel.close')}
          onClose={() => setOpen(null)}
        >
          <NewGame session={session} snapshot={snapshot} onDone={() => setOpen(null)} />
        </Panel>
      ) : null}
      {open === 'finances' ? (
        <Panel
          title={t('finances.title')}
          closeLabel={t('panel.close')}
          onClose={() => setOpen(null)}
        >
          <FinancesWindow
            locale={snapshot.locale}
            money={snapshot.money}
            loan={snapshot.loan}
            maxLoan={snapshot.maxLoan}
            onLoan={(action, all) => session.changeLoan(action, all)}
          />
        </Panel>
      ) : null}
      {queryWindow === null || open !== null ? null : (
        <Panel
          title={windowTitle(queryWindow)}
          closeLabel={t('panel.close')}
          onClose={() => session.closeWindow()}
        >
          {queryWindow.kind === 'tile' ? (
            <TileInfo
              locale={snapshot.locale}
              info={queryWindow.info}
              townName={queryWindow.townName}
              station={queryWindow.station}
              depot={queryWindow.depot}
              onOpenTown={(index) => session.openTown(index)}
            />
          ) : null}
          {queryWindow.kind === 'town' ? (
            <TownWindow locale={snapshot.locale} info={queryWindow.info} />
          ) : null}
          {queryWindow.kind === 'industry' ? (
            <IndustryWindow locale={snapshot.locale} info={queryWindow.info} />
          ) : null}
        </Panel>
      )}
      {snapshot.generationError !== null && open !== 'newGame' ? (
        <div class="generation-error">
          <p role="alert">{t(snapshot.generationError)}</p>
          <button type="button" onClick={() => setOpen('newGame')}>
            {t('newGame.retry')}
          </button>
        </div>
      ) : null}
      {snapshot.generating === null ? null : (
        <div class="generating" role="status">
          {translate(snapshot.locale, 'newGame.generating', {
            percent: Math.round(snapshot.generating * 100),
          })}
        </div>
      )}
    </HoverDelay.Provider>
  );
}
