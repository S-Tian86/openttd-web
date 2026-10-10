// Deliberately breaks the render/ barrier with imports; boundary.test.ts checks that the
// linter rejects them. The sim import is the control: render may import sim.
import { GameSession } from '../../src/app/session';
import { translate } from '../../src/ui/session';
import { createGame } from '../../src/sim/game';

export const leaks = [GameSession, translate, createGame];
