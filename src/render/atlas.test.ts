import { describe, expect, it } from 'vitest';
import { atlasCell } from './atlas';

describe('sprite atlas grid', () => {
  it('fills rows of 16 cells', () => {
    expect([atlasCell(0, 64, 64), atlasCell(17, 64, 64), atlasCell(16, 64, 128)]).toEqual([
      { x: 0, y: 0 },
      { x: 64, y: 64 },
      { x: 0, y: 128 },
    ]);
  });
});
