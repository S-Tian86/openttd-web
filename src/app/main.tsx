import { AUTO, Game, Scale } from 'phaser';
import { render } from 'preact';
import { MapScene } from '../render/MapScene';
import { createGame } from '../sim/world/generate';
import { App } from '../ui/App';
import { loadLocale, saveLocale, translate } from '../ui/i18n/i18n';
import '../ui/styles.css';
import { GameSession } from './session';
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

  const state = createGame({ seed: crypto.getRandomValues(new Uint32Array(1))[0]! });
  const session = new GameSession(
    state,
    locale,
    themes.map((theme) => ({ id: theme.id, name: theme.name })),
    FALLBACK_THEME_ID,
    (next) => {
      saveLocale(getStorage(), next);
      document.documentElement.lang = next;
    },
    (id) => {
      const theme = themes.find((candidate) => candidate.id === id);
      if (theme !== undefined) applyTokens(theme, baseOf(id));
    },
  );

  const scene = new MapScene(state, fallback, fallback, baseOf(fallback.id), baseOf(fallback.id));
  scene.showGame(state);
  const game = new Game({
    type: AUTO,
    parent: 'game',
    backgroundColor: '#1f2a33',
    scale: { mode: Scale.RESIZE, width: '100%', height: '100%' },
    scene: [scene],
  });

  render(<App session={session} />, ui);

  const loop = (now: number): void => {
    session.frame(now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(() => loop(performance.now()));
  return game;
}

export const game = start();
