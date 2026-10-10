import { parseTheme, THEMES_INDEX_PATH, type Theme } from '../render/theme';

export const FALLBACK_THEME_ID = 'blocks';

export interface LoadedThemes {
  themes: Theme[];
  fallback: Theme;
  /** Folder of each theme by id, with a trailing slash. */
  bases: Record<string, string>;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

function parseIndex(json: unknown): { id: string; path: string }[] {
  if (!Array.isArray(json)) throw new Error('Invalid themes index');
  const entries: { id: string; path: string }[] = [];
  for (const item of json as unknown[]) {
    const entry = item as { id?: unknown; path?: unknown } | null;
    if (typeof entry?.id === 'string' && typeof entry.path === 'string') {
      entries.push({ id: entry.id, path: entry.path });
    }
  }
  return entries;
}

/**
 * Loads every theme listed in the index. A theme that fails is skipped; the fallback theme
 * failing is fatal and throws.
 */
export async function loadThemes(): Promise<LoadedThemes> {
  const entries = parseIndex(await fetchJson(THEMES_INDEX_PATH));
  const themes: Theme[] = [];
  const bases: Record<string, string> = {};
  for (const { id, path } of entries) {
    try {
      const theme = parseTheme(await fetchJson(`${path}theme.json`));
      themes.push(theme);
      bases[theme.id] = path;
    } catch (error) {
      console.warn(`Theme "${id}" skipped`, error);
    }
  }
  const fallback = themes.find((theme) => theme.id === FALLBACK_THEME_ID);
  if (fallback === undefined) throw new Error(`Fallback theme "${FALLBACK_THEME_ID}" failed`);
  return { themes, fallback, bases };
}

/** Points the page at the theme's design tokens stylesheet. */
export function applyTokens(theme: Theme, base: string): void {
  let link = document.getElementById('theme-tokens') as HTMLLinkElement | null;
  if (link === null) {
    link = document.createElement('link');
    link.id = 'theme-tokens';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  link.href = `${base}${theme.tokens}`;
}
