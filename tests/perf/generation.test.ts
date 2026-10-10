import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/sim/world/generate';

describe('world generation performance (ruling R8)', () => {
  it('generates the default 256×256 world in under 3 seconds', () => {
    const start = performance.now();
    const game = createGame({ seed: 1 });
    expect(game.map.size).toBe(65536);
    expect(performance.now() - start).toBeLessThan(3000);
  });

  it('can generate a 1024×1024 world', { timeout: 120_000 }, () => {
    expect(createGame({ mapLogX: 10, mapLogY: 10, seed: 1 }).map.size).toBe(1 << 20);
  });
});
