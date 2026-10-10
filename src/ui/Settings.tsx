import { Dropdown } from './Dropdown';
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
      <Dropdown<Locale>
        label={translate(locale, 'settings.language')}
        value={locale}
        options={LOCALES.map((code) => ({
          value: code,
          label: translate(locale, code === 'en' ? 'language.en' : 'language.es'),
        }))}
        onChange={(next) => session.setLocale(next)}
      />
      <Dropdown
        label={translate(locale, 'settings.theme')}
        value={snapshot.themeId}
        options={snapshot.themes.map((theme) => ({ value: theme.id, label: theme.name }))}
        onChange={(id) => session.setTheme(id)}
      />
    </div>
  );
}
