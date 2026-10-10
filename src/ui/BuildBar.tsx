import { errorText } from './errors';
import { formatMoney, translate } from './i18n/i18n';
import type { UiSession, UiSnapshot } from './session';

/**
 * The cost bar of the gesture in progress (R31): the test run's cost, or the error the build
 * would show; on touch, the Confirm and Cancel buttons of a lifted finger (R20).
 */
export function BuildBar({ session, snapshot }: { session: UiSession; snapshot: UiSnapshot }) {
  const { preview, locale } = snapshot;
  if (preview === null) return null;
  const text =
    preview.error !== null
      ? errorText(locale, preview.error)
      : translate(locale, preview.cost < 0 ? 'build.estimatedIncome' : 'build.estimatedCost', {
          money: formatMoney(locale, Math.abs(preview.cost)),
        });
  return (
    <div class={'build-bar ' + (preview.ok ? 'ok' : 'bad')} role="status">
      <span>{text}</span>
      {preview.needsConfirm ? (
        <div class="build-bar-actions">
          <button type="button" onClick={() => session.confirmBuild()}>
            {translate(locale, 'build.confirm')}
          </button>
          <button type="button" onClick={() => session.cancelBuild()}>
            {translate(locale, 'build.cancel')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
