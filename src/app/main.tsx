import { AUTO, Game, Scale } from 'phaser';
import { render } from 'preact';
import { MapScene } from '../render/MapScene';
import { createEmptyGame, DEFAULT_GAME_OPTIONS, hashGameState } from '../sim/game';
import { tileXY } from '../sim/map/map';
import { townName } from '../sim/town/town-names';
import { App } from '../ui/App';
import { loadLocale, saveLocale, translate } from '../ui/i18n/i18n';
import '../ui/styles.css';
import { townLabel } from '../ui/town-label';
import { GameSession } from './session';
import { parseStartParams } from './start-params';
import { applyTokens, FALLBACK_THEME_ID, loadThemes } from './theme-loader';

/** `window.localStorage` itself can throw (private modes, blocked site data). */
function getStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function showFatalError(ui: HTMLElement, message: string): void {
  const box = document.createElement('div');
  box.className = 'ui-error';
  box.setAttribute('role', 'alert');
  box.textContent = message;
  ui.replaceChildren(box);
}

async function start(): Promise<Game | undefined> {
  const ui = document.getElementById('ui');
  if (ui === null) return undefined;

  const storage = getStorage();
  const locale = loadLocale(storage, navigator.languages);
  document.documentElement.lang = locale;

  let loaded;
  try {
    loaded = await loadThemes();
  } catch (error) {
    console.error(error);
    showFatalError(ui, translate(locale, 'error.themeLoad'));
    return undefined;
  }
  const { themes, fallback, bases } = loaded;
  const baseOf = (id: string): string => bases[id] ?? '';

  applyTokens(fallback, baseOf(fallback.id));

  const params = parseStartParams(window.location.search);
  const placeholder = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  // The scene is built first and the session needs it, so the callbacks reach the session late.
  // The map asks for every town sign each frame; a name only depends on its parts.
  const townNames = new Map<number, string>();
  const townNameOf = (parts: number): string => {
    let name = townNames.get(parts);
    if (name === undefined) {
      name = townName(parts);
      townNames.set(parts, name);
    }
    return name;
  };
  const scene = new MapScene(
    placeholder,
    fallback,
    fallback,
    baseOf(fallback.id),
    baseOf(fallback.id),
    {
      onTap: (tile) => session.tapTile(tile, false),
      onLongPress: (tile) => session.tapTile(tile, true),
    },
    {
      townLabel: (town, small) =>
        townLabel(
          session.getSnapshot().locale,
          { name: townNameOf(town.nameParts), population: town.population, isCity: town.isCity },
          small,
        ),
    },
  );
  let focus = params.focus;
  const session = new GameSession(placeholder, {
    locale,
    themes: themes.map((theme) => ({ id: theme.id, name: theme.name })),
    themeId: FALLBACK_THEME_ID,
    onLocale: (next) => {
      saveLocale(getStorage(), next);
      document.documentElement.lang = next;
    },
    onTheme: (id) => {
      const theme = themes.find((candidate) => candidate.id === id);
      if (theme !== undefined) applyTokens(theme, baseOf(id));
      scene.restyleLabels();
    },
    onNewState: (state) => {
      const tile =
        focus !== undefined && focus.x < state.map.sizeX && focus.y < state.map.sizeY
          ? tileXY(state.map, focus.x, focus.y)
          : undefined;
      focus = undefined; // only the first world
      if (tile === undefined) scene.showGame(state);
      else scene.showGame(state, tile);
      document.documentElement.dataset['worldHash'] = hashGameState(state);
    },
  });
  const game = new Game({
    type: AUTO,
    parent: 'game',
    backgroundColor: '#1f2a33',
    scale: { mode: Scale.RESIZE, width: '100%', height: '100%' },
    scene: [scene],
  });

  render(<App session={session} />, ui);

  // Readiness signal for a failed start (no world will ever be shown): e2e and users can tell why.
  session.subscribe(() => {
    const { generationError } = session.getSnapshot();
    if (generationError === null) delete document.documentElement.dataset['generationError'];
    else document.documentElement.dataset['generationError'] = generationError;
  });

  const options = {
    ...DEFAULT_GAME_OPTIONS,
    seed: params.seed ?? crypto.getRandomValues(new Uint32Array(1))[0]!,
  };
  session.newGame(
    params.mapLogX === undefined || params.mapLogY === undefined
      ? options
      : { ...options, mapLogX: params.mapLogX, mapLogY: params.mapLogY },
  );

  const loop = (now: number): void => {
    // Scheduled first: one failing frame must not stop the game for good.
    requestAnimationFrame(loop);
    try {
      session.frame(now);
    } catch (error) {
      console.error(error);
    }
  };
  requestAnimationFrame(() => loop(performance.now()));
  return game;
}

export const game = start();
