import Phaser from 'phaser';
import { BootScene } from '../render/BootScene';
import '../ui/styles.css';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#bfe6c8',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  scene: [BootScene],
});
