import { useState } from 'preact/hooks';
import { translate } from './i18n/i18n';
import { Panel } from './Panel';
import type { UiSession } from './session';
import { Settings } from './Settings';
import { StatusBar } from './StatusBar';
import { useSnapshot } from './useSnapshot';

export function App({ session }: { session: UiSession }) {
  const snapshot = useSnapshot(session);
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <>
      <StatusBar
        session={session}
        snapshot={snapshot}
        onSettings={() => setSettingsOpen((open) => !open)}
      />
      {settingsOpen ? (
        <Panel
          title={translate(snapshot.locale, 'settings.title')}
          closeLabel={translate(snapshot.locale, 'panel.close')}
          onClose={() => setSettingsOpen(false)}
        >
          <Settings session={session} snapshot={snapshot} />
        </Panel>
      ) : null}
    </>
  );
}
