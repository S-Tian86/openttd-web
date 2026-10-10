import { useState } from 'preact/hooks';
import { translate } from './i18n/i18n';
import { NewGame } from './NewGame';
import { Panel } from './Panel';
import type { UiSession } from './session';
import { Settings } from './Settings';
import { StatusBar } from './StatusBar';
import { useSnapshot } from './useSnapshot';

type PanelId = 'settings' | 'newGame';

export function App({ session }: { session: UiSession }) {
  const snapshot = useSnapshot(session);
  const [open, setOpen] = useState<PanelId | null>(null);
  const toggle = (id: PanelId): void => setOpen((current) => (current === id ? null : id));
  const t = (key: Parameters<typeof translate>[1]): string => translate(snapshot.locale, key);
  return (
    <>
      <StatusBar
        session={session}
        snapshot={snapshot}
        onNewGame={() => toggle('newGame')}
        onSettings={() => toggle('settings')}
      />
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
      {snapshot.generating === null ? null : (
        <div class="generating" role="status">
          {translate(snapshot.locale, 'newGame.generating', {
            percent: Math.round(snapshot.generating * 100),
          })}
        </div>
      )}
    </>
  );
}
