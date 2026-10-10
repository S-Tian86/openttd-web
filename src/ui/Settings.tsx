import { LOCALES, translate } from './i18n/i18n';
import type { Locale, UiSession, UiSnapshot } from './session';

interface SettingsProps {
  session: UiSession;
  snapshot: UiSnapshot;
}

export function Settings({ session, snapshot }: SettingsProps) {
  const { locale } = snapshot;
  return (
    <div class="settings">
      <label>
        <span>{translate(locale, 'settings.language')}</span>
        <select
          value={locale}
          onChange={(event) => session.setLocale(event.currentTarget.value as Locale)}
        >
          {LOCALES.map((code) => (
            <option key={code} value={code}>
              {translate(locale, code === 'en' ? 'language.en' : 'language.es')}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{translate(locale, 'settings.theme')}</span>
        <select
          value={snapshot.themeId}
          onChange={(event) => session.setTheme(event.currentTarget.value)}
        >
          {snapshot.themes.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
