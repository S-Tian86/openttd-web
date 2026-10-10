import { AUTO, Game, Scale } from 'phaser';
import { MapScene } from '../render/MapScene';
import { parseTheme } from '../render/theme';
import { createGame } from '../sim/game';
import '../ui/styles.css';

const THEME_BASE = 'themes/blocks/';

async function start(): Promise<Game> {
  const response = await fetch(`${THEME_BASE}theme.json`);
  const theme = parseTheme(await response.json());
  const state = createGame();
  return new Game({
    type: AUTO,
    parent: 'game',
    backgroundColor: '#1f2a33',
    scale: { mode: Scale.RESIZE, width: '100%', height: '100%' },
    scene: [new MapScene(state, theme, theme, THEME_BASE, THEME_BASE)],
  });
}

export const game = start();
