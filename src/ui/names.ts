import type { DepotInfo, StationInfo } from '../sim/query';
import { translate, type MessageKey } from './i18n/i18n';
import type { Locale } from './session';

/** strings.cpp station names: the generated kind, relative to its town (stations-cargo.md 4.2). */
export const stationName = (locale: Locale, info: StationInfo): string =>
  translate(locale, `station.name.${info.nameKind}` as MessageKey, {
    town: info.townName,
    number: info.index,
  });

/** strings.cpp depot names: the town, plus the town's serial number from the second depot on. */
export const depotName = (locale: Locale, info: DepotInfo): string =>
  info.townCn === 0
    ? translate(locale, 'depot.name', { town: info.townName })
    : translate(locale, 'depot.nameSerial', { town: info.townName, number: info.townCn + 1 });
