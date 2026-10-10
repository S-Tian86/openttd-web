import { useEffect } from 'preact/hooks';
import { errorText } from './errors';
import { translate } from './i18n/i18n';
import type { UiSession, UiSnapshot } from './session';

/** Port of the gui.errmsg_duration default: an error window closes itself after 5 seconds. */
export const ERROR_MESSAGE_MS = 5000;

/** Port of error_gui.cpp:ErrmsgWindow: the header, the detail below it; a click closes it. */
export function ErrorMessage({ session, snapshot }: { session: UiSession; snapshot: UiSnapshot }) {
  const { error, locale } = snapshot;
  useEffect(() => {
    if (error === null) return undefined;
    const timer = window.setTimeout(() => session.dismissError(), ERROR_MESSAGE_MS);
    return () => window.clearTimeout(timer);
  }, [error, session]);
  if (error === null) return null;
  return (
    <div class="error-message" role="alert" onClick={() => session.dismissError()}>
      <p class="error-header">{translate(locale, error.header)}</p>
      {error.detail === null ? null : <p>{errorText(locale, error.detail)}</p>}
    </div>
  );
}
