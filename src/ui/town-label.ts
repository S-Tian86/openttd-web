import { formatNumber, translate } from './i18n/i18n';
import type { Locale } from './session';

interface TownLabelInfo {
  name: string;
  population: number;
  isCity: boolean;
}

/**
 * The town sign on the map (viewport.cpp ViewportAddTownStrings): the name and population up
 * close, as gui.population_in_label defaults to true, with the city mark for cities
 * (STR_VIEWPORT_TOWN_POP, STR_VIEWPORT_TOWN_CITY_POP); only the name when small (STR_TOWN_NAME).
 */
export function townLabel(locale: Locale, town: TownLabelInfo, small: boolean): string {
  if (small) return town.name;
  return translate(locale, town.isCity ? 'map.townLabelCity' : 'map.townLabel', {
    town: town.name,
    population: formatNumber(locale, town.population),
  });
}
