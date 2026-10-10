import Phaser from 'phaser';

/** Placeholder scene until Stage 1 draws the map. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'openttd-web', {
        fontFamily: 'sans-serif',
        fontSize: '32px',
        color: '#2d4a3e',
      })
      .setOrigin(0.5);
    // Signals to end-to-end tests that the first frame is ready.
    document.documentElement.dataset['gameReady'] = 'true';
  }
}
