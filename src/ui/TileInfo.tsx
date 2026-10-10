import type { DepotInfo, StationInfo, TileInfo as TileInfoData } from '../sim/query';
import { formatMoney, translate, type MessageKey } from './i18n/i18n';
import { depotName, stationName } from './names';
import type { Locale } from './session';

interface TileInfoProps {
  locale: Locale;
  info: TileInfoData;
  townName: string | null;
  station: StationInfo | null;
  depot: DepotInfo | null;
  onOpenTown: (index: number) => void;
}

export function TileInfo({ locale, info, townName, station, depot, onOpenTown }: TileInfoProps) {
  const t = (key: MessageKey, params?: Record<string, string | number>): string =>
    translate(locale, key, params);
  const ownerName = (owner: TileInfoData['owner']): string => {
    if (owner === 'town' && townName !== null) return townName;
    if (owner === 'company') return t('owner.company'); // R27: no company names yet
    return t(owner === 'water' ? 'owner.water' : 'owner.none');
  };
  return (
    <div class="tile-info">
      <p class="tile-kind">{t(`tile.kind.${info.kind}`)}</p>
      {station === null ? null : <p>{stationName(locale, station)}</p>}
      {depot === null ? null : <p>{depotName(locale, depot)}</p>}
      {info.kind === 'crossing' ? (
        <>
          <p>{t('tile.railOwner', { owner: ownerName(info.owner) })}</p>
          <p>{t('tile.roadOwner', { owner: townName ?? t('owner.none') })}</p>
        </>
      ) : (
        <p>{t('tile.owner', { owner: ownerName(info.owner) })}</p>
      )}
      <p>{t('tile.location', { x: info.x, y: info.y, z: info.z })}</p>
      <p>
        {info.costToClear === null
          ? t('tile.costToClearNA')
          : t('tile.costToClear', { money: formatMoney(locale, info.costToClear) })}
      </p>
      {info.townIndex === null ? null : (
        <button type="button" onClick={() => onOpenTown(info.townIndex!)}>
          {t('tile.openTown')}
        </button>
      )}
    </div>
  );
}
