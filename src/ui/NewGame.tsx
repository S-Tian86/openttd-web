import { useEffect, useRef, useState } from 'preact/hooks';
import { translate, type MessageKey } from './i18n/i18n';
import type { UiSession, UiSnapshot } from './session';

/** Map size per axis as log2: 64..1024 tiles. */
export const MAP_SIZE_BITS = [6, 7, 8, 9, 10] as const;
const TOWN_LEVELS = [0, 1, 2, 3] as const;
const INDUSTRY_LEVELS = [0, 1, 2, 3, 4, 5] as const;
const MAX_SEED = 0xffffffff;

/** A seed is a uint32 written in digits; anything else is refused instead of reaching the simulation. */
export function parseSeed(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const seed = Number(text);
  return seed <= MAX_SEED ? seed : null;
}

/** A level from a select, only if it is one of `allowed` (defaultTownCount is undefined outside 0..3). */
function parseLevel<T extends number>(text: string, allowed: readonly T[]): T | null {
  return allowed.find((level) => String(level) === text) ?? null;
}

interface NewGameProps {
  session: UiSession;
  snapshot: UiSnapshot;
  onDone: () => void;
}

export function NewGame({ session, snapshot, onDone }: NewGameProps) {
  const { locale, gameOptions } = snapshot;
  const t = (key: MessageKey): string => translate(locale, key);
  const [mapLogX, setMapLogX] = useState<number>(gameOptions.mapLogX);
  const [mapLogY, setMapLogY] = useState<number>(gameOptions.mapLogY);
  const [townCount, setTownCount] = useState<number>(gameOptions.townCount);
  const [industryDensity, setIndustryDensity] = useState<number>(gameOptions.industryDensity);
  const [seedText, setSeedText] = useState(String(gameOptions.seed));
  const sawBusy = useRef(false);

  // Close once the generation this window started has finished without an error.
  useEffect(() => {
    if (snapshot.generating !== null) sawBusy.current = true;
    else if (sawBusy.current && snapshot.generationError === null) onDone();
  }, [snapshot.generating, snapshot.generationError, onDone]);

  const seed = parseSeed(seedText);
  const busy = snapshot.generating !== null;

  const select = <T extends number>(
    label: MessageKey,
    levels: readonly T[],
    value: number,
    set: (level: T) => void,
    optionLabel: (level: T) => string,
  ) => (
    <label>
      <span>{t(label)}</span>
      <select
        value={String(value)}
        onChange={(event) => {
          const level = parseLevel(event.currentTarget.value, levels);
          if (level !== null) set(level);
        }}
      >
        {levels.map((level) => (
          <option key={level} value={String(level)}>
            {optionLabel(level)}
          </option>
        ))}
      </select>
    </label>
  );

  const generate = (): void => {
    if (seed === null || busy) return;
    session.newGame({ ...gameOptions, mapLogX, mapLogY, townCount, industryDensity, seed });
  };

  return (
    <form
      class="new-game"
      onSubmit={(event) => {
        event.preventDefault();
        generate();
      }}
    >
      {select('newGame.mapX', MAP_SIZE_BITS, mapLogX, setMapLogX, (bits) => String(2 ** bits))}
      {select('newGame.mapY', MAP_SIZE_BITS, mapLogY, setMapLogY, (bits) => String(2 ** bits))}
      {select('newGame.towns', TOWN_LEVELS, townCount, setTownCount, (level) =>
        t(`newGame.towns.${level}`),
      )}
      {select('newGame.industries', INDUSTRY_LEVELS, industryDensity, setIndustryDensity, (level) =>
        t(`newGame.industries.${level}`),
      )}
      <label>
        <span>{t('newGame.seed')}</span>
        <input
          type="text"
          inputMode="numeric"
          value={seedText}
          aria-invalid={seed === null}
          onInput={(event) => setSeedText(event.currentTarget.value)}
        />
      </label>
      <button
        type="button"
        onClick={() => setSeedText(String(Math.floor(Math.random() * 2 ** 32)))}
      >
        {t('newGame.randomSeed')}
      </button>
      {snapshot.generationError === null ? null : <p role="alert">{t(snapshot.generationError)}</p>}
      <button type="button" disabled={seed === null || busy} onClick={generate}>
        {t('newGame.generate')}
      </button>
    </form>
  );
}
