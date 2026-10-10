import type { TileInfo as TileInfoData } from '../sim/query';
import { translate, type MessageKey } from './i18n/i18n';
import type { Locale } from './session';

interface TileInfoProps {
  locale: Locale;
  info: TileInfoData;
  townName: string | null;
  onOpenTown: (index: number) => void;
}

export function TileInfo({ locale, info, townName, onOpenTown }: TileInfoProps) {
  const t = (key: MessageKey, params?: Record<string, string | number>): string =>
    translate(locale, key, params);
  const owner =
    info.owner === 'town' && townName !== null
      ? townName
      : t(info.owner === 'water' ? 'owner.water' : 'owner.none');
  return (
    <div class="tile-info">
      <p class="tile-kind">{t(`tile.kind.${info.kind}`)}</p>
      <p>{t('tile.owner', { owner })}</p>
      <p>{t('tile.location', { x: info.x, y: info.y, z: info.z })}</p>
      {info.townIndex === null ? null : (
        <button type="button" onClick={() => onOpenTown(info.townIndex!)}>
          {t('tile.openTown')}
        </button>
      )}
    </div>
  );
}
