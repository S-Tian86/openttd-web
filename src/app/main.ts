import { AUTO, Game, Scale } from 'phaser';
import { BootScene } from '../render/BootScene';
import '../ui/styles.css';

export const game = new Game({
  type: AUTO,
  parent: 'game',
  backgroundColor: '#bfe6c8',
  scale: { mode: Scale.RESIZE, width: '100%', height: '100%' },
  scene: [BootScene],
});
