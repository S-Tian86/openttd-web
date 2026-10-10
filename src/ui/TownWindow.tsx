import type { TownInfo } from '../sim/query';
import { formatNumber, translate } from './i18n/i18n';
import type { Locale } from './session';

export function TownWindow({ locale, info }: { locale: Locale; info: TownInfo }) {
  return (
    <div class="town-window">
      <p>
        {translate(locale, 'town.population', {
          population: formatNumber(locale, info.population),
        })}
      </p>
      <p>{translate(locale, 'town.houses', { houses: formatNumber(locale, info.houses) })}</p>
    </div>
  );
}
