import { describe, expect, it } from 'vitest';
import en from './en.json';
import es from './es.json';
import { detectLocale, formatDate, formatMoney, loadLocale, saveLocale, translate } from './i18n';

describe('translations', () => {
  it('ships Spanish with exactly the English keys', () => {
    expect(Object.keys(es).toSorted()).toEqual(Object.keys(en).toSorted());
  });

  it('translates', () => {
    expect(translate('es', 'settings.title')).toBe('Ajustes');
    expect(translate('en', 'hud.pause')).toBe('Pause');
  });

  it('detects Spanish from any es-* browser language, English otherwise', () => {
    expect(detectLocale(['es-CL', 'en'])).toBe('es');
    expect(detectLocale(['fr-FR'])).toBe('en');
  });

  it('remembers the choice, and survives storage that throws', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    saveLocale(storage, 'es');
    expect(loadLocale(storage, ['en'])).toBe('es');
    const broken = {
      getItem: (): string => {
        throw new Error('blocked');
      },
      setItem: (): void => {
        throw new Error('blocked');
      },
    };
    expect(() => saveLocale(broken, 'es')).not.toThrow();
    expect(loadLocale(broken, ['es-AR'])).toBe('es');
  });

  it('formats pounds without decimals and dates in the locale', () => {
    expect(formatMoney('en', 100000)).toBe('£100,000');
    expect(formatMoney('es', 100000)).toMatch(/100\.000\s?£/);
    expect(formatDate('en', 1950, 0, 1)).toMatch(/1950/);
    expect(formatDate('es', 1950, 0, 1)).toMatch(/ene/);
  });
});
