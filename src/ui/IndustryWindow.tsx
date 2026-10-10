import type { IndustryInfo } from '../sim/query';
import { translate } from './i18n/i18n';
import type { Locale } from './session';

/** The industry's name: used as the window title and as the heading of the body. */
export function industryName(locale: Locale, info: IndustryInfo): string {
  return translate(locale, 'industry.name', {
    town: info.townName,
    type: translate(locale, `industry.${info.type}`),
  });
}

export function IndustryWindow({ locale, info }: { locale: Locale; info: IndustryInfo }) {
  return (
    <div class="industry-window">
      <h3>{industryName(locale, info)}</h3>
      <p>{translate(locale, 'industry.location', { x: info.x, y: info.y })}</p>
    </div>
  );
}
