import { Dropdown } from './Dropdown';
import { formatNumber, LOCALES, translate } from './i18n/i18n';
import {
  SCROLL_MODES,
  WHEEL_MODES,
  WHEEL_SPEEDS,
  type Locale,
  type UiSession,
  type UiSnapshot,
} from './session';

interface SettingsProps {
  session: UiSession;
  snapshot: UiSnapshot;
}

export function Settings({ session, snapshot }: SettingsProps) {
  const { locale, controls } = snapshot;
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
      <Dropdown
        label={translate(locale, 'settings.scrollMode')}
        value={controls.scrollMode}
        options={SCROLL_MODES.map((mode) => ({
          value: mode,
          label: translate(locale, `settings.scrollMode.${mode}`),
        }))}
        onChange={(scrollMode) => session.setControls({ ...controls, scrollMode })}
      />
      <Dropdown
        label={translate(locale, 'settings.wheel')}
        value={controls.wheel}
        options={WHEEL_MODES.map((wheel) => ({
          value: wheel,
          label: translate(locale, `settings.wheel.${wheel}`),
        }))}
        onChange={(wheel) => session.setControls({ ...controls, wheel })}
      />
      <Dropdown
        label={translate(locale, 'settings.wheelSpeed')}
        value={controls.wheelSpeed}
        options={WHEEL_SPEEDS.map((speed) => ({
          value: speed,
          label: formatNumber(locale, speed),
        }))}
        onChange={(wheelSpeed) => session.setControls({ ...controls, wheelSpeed })}
      />
    </div>
  );
}
