import { formatMoney, translate } from './i18n/i18n';
import type { Locale, UiCommandError } from './session';

/**
 * The detail line of an error with its parameters filled in: money as currency, the industry
 * by its type name (industry_cmd.cpp: indspec->name, "Coal Mine in the way"), the town by name.
 */
export function errorText(locale: Locale, e: UiCommandError): string {
  const params: Record<string, string> = {};
  if (e.money !== null) params['money'] = formatMoney(locale, e.money);
  if (e.industry !== null) params['industry'] = translate(locale, `industry.${e.industry.type}`);
  if (e.town !== null) params['town'] = e.town;
  return translate(locale, e.key, params);
}
