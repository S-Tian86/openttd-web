// Deliberately breaks the sim/ barrier with imports; boundary.test.ts checks that the
// linter rejects them. The sim import is the control: sim may import sim.
import { Scene } from 'phaser';
import { readFileSync } from 'node:fs';
import { TILE_PX } from '../../src/render/projection';
import { economy } from '../../reference/OpenTTD/src/economy';
import { DAY_TICKS } from '../../src/sim/core/constants';

export const leaks = [Scene, readFileSync, TILE_PX, economy, DAY_TICKS];
