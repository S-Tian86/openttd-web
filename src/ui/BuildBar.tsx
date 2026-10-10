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
  // A failed test with no message (CMD_ERROR, e.g. a void edge tile) has nothing to show: the
  // build would be refused silently. A demolition the cash cannot cover keeps its estimate.
  const text =
    preview.error !== null
      ? errorText(locale, preview.error)
      : !preview.ok && preview.cost === 0
        ? ''
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
