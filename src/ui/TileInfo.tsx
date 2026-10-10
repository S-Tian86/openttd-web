import type { DepotInfo, StationInfo, TileInfo as TileInfoData } from '../sim/query';
import { formatDate, formatMoney, formatSpeed, translate, type MessageKey } from './i18n/i18n';
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
  const roadOwnerName = (): string => {
    if (info.roadOwner === 'town' && townName !== null) return townName;
    return t(info.roadOwner === 'company' ? 'owner.company' : 'owner.none');
  };
  // LandInfoWindow::OnInit: a refund is shown as revenue.
  let costLine = t('tile.costToClearNA');
  if (info.costToClear !== null && info.costToClear < 0)
    costLine = t('tile.revenueWhenCleared', { money: formatMoney(locale, -info.costToClear) });
  else if (info.costToClear !== null)
    costLine = t('tile.costToClear', { money: formatMoney(locale, info.costToClear) });
  return (
    <div class="tile-info">
      <p class="tile-kind">{t(`tile.kind.${info.kind}`)}</p>
      {station === null ? null : <p>{stationName(locale, station)}</p>}
      {depot === null ? null : <p>{depotName(locale, depot)}</p>}
      {info.kind === 'crossing' ? (
        <>
          <p>{t('tile.railOwner', { owner: ownerName(info.owner) })}</p>
          <p>{t('tile.roadOwner', { owner: roadOwnerName() })}</p>
        </>
      ) : (
        <p>{t('tile.owner', { owner: ownerName(info.owner) })}</p>
      )}
      <p>{costLine}</p>
      <p>{t('tile.location', { x: info.x, y: info.y, z: info.z })}</p>
      {info.buildDate === null ? null : (
        <p>
          {t('tile.buildDate', {
            date: formatDate(locale, info.buildDate.year, info.buildDate.month, info.buildDate.day),
          })}
        </p>
      )}
      {info.railType === null ? null : (
        <p>{t('tile.railType', { type: t(`railType.${info.railType}`) })}</p>
      )}
      {info.railSpeed === null ? null : (
        <p>{t('tile.railSpeed', { speed: formatSpeed(locale, info.railSpeed) })}</p>
      )}
      {info.townIndex === null ? null : (
        <button type="button" onClick={() => onOpenTown(info.townIndex!)}>
          {t('tile.openTown')}
        </button>
      )}
    </div>
  );
}
